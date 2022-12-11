import {
  isBlob,
  isBuffer,
  toArrayBuffer,
  toBase64,
  toBlob,
  toBuffer,
} from "./BinaryConverter";
import { ContentsCache } from "./ContentsCache";
import {
  AbstractFileError,
  InvalidModificationError,
  NoModificationAllowedError,
  NotFoundError,
  NotReadableError,
} from "./FileError";
import { DataType, FileSystem } from "./filesystem";
import {
  DIR_SEPARATOR,
  INDEX_DIR_PATH,
  INDEX_PREFIX,
  INDEX_PREFIX_LEN,
} from "./FileSystemConstants";
import { FileNameIndex, Record, RecordCache } from "./FileSystemIndex";
import { FileSystemObject } from "./FileSystemObject";
import { FileSystemOptions } from "./FileSystemOptions";
import {
  getName,
  getParentPath,
  isIllegalObject,
  onError,
} from "./FileSystemUtil";
import { objectToText, textToObject } from "./ObjectUtil";
import { textToUint8Array, toText } from "./TextConverter";

export abstract class AbstractAccessor {
  protected contentsCache: ContentsCache;
  protected recordCache: RecordCache = {};

  public abstract readonly filesystem: FileSystem;
  public abstract readonly name: string;

  constructor(public readonly options: FileSystemOptions) {
    this.initialize(options);
  }

  public clearContentsCache(fullPath: string) {
    if (this.contentsCache == null) {
      return;
    }
    this.contentsCache.remove(fullPath);
  }

  public async createIndexPath(fullPath: string, createDirectory: boolean) {
    const name = getName(fullPath);
    const parentPath = getParentPath(fullPath);
    const indexName = INDEX_PREFIX + name;
    let indexDir = INDEX_DIR_PATH + parentPath;
    if (!indexDir.endsWith(DIR_SEPARATOR)) {
      indexDir += DIR_SEPARATOR;
    }
    const indexPath = indexDir + indexName;
    if (!createDirectory) {
      return indexPath;
    }
    await this.makeDirectory(indexDir);
    return indexPath;
  }

  public async createRecord(obj: FileSystemObject) {
    const fullPath = obj.fullPath;
    const lastModified = obj.lastModified ?? Date.now();
    const size = obj.size;
    let record: Record;
    try {
      record = await this.getRecord(fullPath);
      if (record.modified === lastModified) {
        return null;
      }
      record.size = size;
      record.modified = lastModified;
      delete record.deleted;
    } catch (e) {
      if (e instanceof NotFoundError) {
        record = { modified: lastModified, size };
      } else if (e instanceof AbstractFileError) {
        throw e;
      } else {
        throw new NotReadableError(this.name, fullPath, e);
      }
    }
    return record;
  }

  public async delete(fullPath: string, isFile: boolean, truncate: boolean) {
    if (truncate) {
      await this.truncateRecord(fullPath);
    } else {
      await this.deleteRecord(fullPath, isFile);
    }

    if (!this.options.indexOptions?.logicalDelete) {
      try {
        await this.doDelete(fullPath, isFile);
      } catch (e) {
        await this.handleWriteError(e, fullPath, isFile);
      }
    }

    if (isFile && this.contentsCache) {
      this.contentsCache.remove(fullPath);
    }
  }

  public async deleteRecord(fullPath: string, _isFile: boolean) {
    if (!this.options.index) {
      return;
    }
    if (fullPath === INDEX_DIR_PATH) {
      return;
    }

    let record: Record;
    try {
      record = await this.getRecord(fullPath);
    } catch (e) {
      if (e instanceof NotFoundError) {
        return;
      } else if (e instanceof AbstractFileError) {
        throw e;
      }
      throw new NotReadableError(this.name, fullPath, e);
    }
    if (record.deleted == null) {
      record.deleted = Date.now();
    }

    const indexPath = await this.createIndexPath(fullPath, false);
    await this.doSaveRecord(indexPath, record);

    const indexObj = await this.doGetObject(indexPath, true);
    this.recordCache[indexPath] = {
      record,
      lastModified: indexObj.lastModified,
    };
  }

  public async deleteRecursively(fullPath: string, truncate: boolean) {
    let children: FileSystemObject[];
    try {
      children = await this.doGetObjects(fullPath);
    } catch (e) {
      await this.handleReadError(e, fullPath, false);
    }

    for (const child of children) {
      if (child.size == null) {
        await this.deleteRecursively(child.fullPath, truncate);
      } else {
        await this.delete(child.fullPath, true, truncate);
      }
    }

    if (
      fullPath !== DIR_SEPARATOR &&
      !(this.options?.index && fullPath === INDEX_DIR_PATH)
    ) {
      await this.delete(fullPath, false, truncate);
    }
  }

  public async doPutObject(
    obj: FileSystemObject,
    content?: Blob | BufferSource | string
  ): Promise<FileSystemObject> {
    const fullPath = obj.fullPath;
    let record: Record;
    try {
      this.debug("putObject", fullPath);
      if (content == null) {
        // Directory
        await this.makeDirectory(obj.fullPath);
        record = { modified: Date.now() };
      } else {
        // File
        await this.doWriteContent(fullPath, content);
        obj = await this.doGetObject(fullPath, true);
        if (this.contentsCache) {
          this.contentsCache.put(obj, content);
        }
        record = await this.createRecord(obj);
      }
    } catch (e) {
      await this.handleWriteError(e, fullPath, obj.size != null);
    }

    if (record) {
      await this.saveRecord(fullPath, record);
    }
    return obj;
  }

  public async doWriteContent(
    fullPath: string,
    content: Blob | BufferSource | string
  ) {
    try {
      if (typeof content === "string") {
        await this.doWriteBase64(fullPath, content);
      } else if (isBlob(content)) {
        await this.doWriteBlob(fullPath, content);
      } else if (isBuffer(content)) {
        await this.doWriteBuffer(fullPath, content);
      } else if (ArrayBuffer.isView(content)) {
        await this.doWriteUint8Array(fullPath, content as Uint8Array);
      } else {
        await this.doWriteArrayBuffer(fullPath, content);
      }
    } catch (e) {
      await this.handleWriteError(e, fullPath, true);
    }
  }

  public async getFileNameIndex(dirPath: string) {
    const fileNameIndex: FileNameIndex = {};
    if (dirPath === INDEX_DIR_PATH) {
      return fileNameIndex;
    }

    const indexDir =
      INDEX_DIR_PATH + (dirPath === DIR_SEPARATOR ? "" : dirPath);
    const objects = await this.doGetObjects(indexDir);

    if (!dirPath.endsWith("/")) {
      dirPath += "/";
    }

    for (const obj of objects) {
      if (obj.size == null) {
        // folder
        continue;
      }
      let fullPath;
      try {
        const name = obj.name.substring(INDEX_PREFIX_LEN);
        fullPath = dirPath + name;
        const record = await this.getRecord(fullPath);
        fileNameIndex[name] = { ...record, fullPath, name };
      } catch (e) {
        console.warn("getFileNameIndex", obj, e);
      }
    }

    return fileNameIndex;
  }

  public async getObject(fullPath: string, isFile: boolean) {
    this.debug("getObject", fullPath);

    let obj: FileSystemObject;
    if (this.options.index) {
      let record: Record;
      try {
        record = await this.getRecord(fullPath);
      } catch (e) {
        if (e instanceof NotFoundError) {
          try {
            obj = await this.doGetObject(fullPath, isFile);
          } catch (e) {
            await this.handleReadError(e, fullPath, isFile);
          }
          await this.saveRecord(fullPath, {
            modified: obj.lastModified,
            size: obj.size,
          });
        } else {
          throw e;
        }
      }
      if (record?.deleted != null) {
        throw new NotFoundError(this.name, fullPath, "getObject");
      }
    }

    if (!obj) {
      try {
        obj = await this.doGetObject(fullPath, isFile);
      } catch (e) {
        await this.handleReadError(e, fullPath, isFile);
      }
    }

    if (!(await this.beforeHead(obj))) {
      throw new NotFoundError(this.name, obj.fullPath, "beforeHead");
    }

    this.afterHead(obj);
    return obj;
  }

  public async getObjects(dirPath: string) {
    try {
      const index = this.options.index;
      const objects = await this.doGetObjects(dirPath);

      if (index) {
        const newObjects: FileSystemObject[] = [];
        for (const obj of objects) {
          if (obj.fullPath === INDEX_DIR_PATH) {
            continue;
          }

          if (this.options.indexOptions.logicalDelete) {
            try {
              const record = await this.getRecord(obj.fullPath);
              if (record.deleted) {
                continue;
              }
            } catch (e) {
              if (e instanceof NotFoundError) {
                const record = await this.createRecord(obj);
                if (record) {
                  await this.saveRecord(obj.fullPath, record);
                }
              } else {
                console.warn("getObjects", obj, e);
              }
              continue;
            }
          }

          if (!(await this.beforeHead(obj))) {
            continue;
          }
          this.afterHead(obj);

          newObjects.push(obj);
        }

        return newObjects;
      } else {
        return objects;
      }
    } catch (e) {
      await this.handleReadError(e, dirPath, false);
    }
  }

  public async getRecord(fullPath: string) {
    const indexPath = await this.createIndexPath(fullPath, false);
    let indexObj: FileSystemObject;
    try {
      indexObj = await this.doGetObject(indexPath, true);
    } catch (e) {
      if (e instanceof NotFoundError) {
        delete this.recordCache[fullPath];
      }
      throw e;
    }
    const entry = this.recordCache[indexPath];
    if (entry && indexObj.lastModified === entry.lastModified) {
      return entry.record;
    }

    const content = await this.doReadContent(indexPath);
    const text = await toText(content);
    const record: Record = textToObject(text);
    this.recordCache[indexPath] = {
      record,
      lastModified: indexObj.lastModified,
    };

    return record;
  }

  public getURL(
    _fullPath: string,
    _method?: "GET" | "POST" | "PUT" | "DELETE"
  ): Promise<string> {
    throw new Error("Not implemented");
  }

  public async makeDirectory(fullPath: string) {
    try {
      await this.doGetObject(fullPath, false);
    } catch (e) {
      if (e instanceof NotFoundError) {
        await this.doMakeDirectory(fullPath);
      } else {
        throw new NotReadableError(this.name, fullPath, e);
      }
    }
  }

  public async purge() {
    await this.deleteRecursively(DIR_SEPARATOR, true);
    this.recordCache = {};
    if (this.contentsCache) {
      this.contentsCache.clear();
    }
  }

  public async putObject(
    obj: FileSystemObject,
    content?: Blob | BufferSource | string
  ): Promise<FileSystemObject> {
    if (isIllegalObject(obj, this.options.index)) {
      const fullPath = obj.fullPath;
      throw new InvalidModificationError(
        this.name,
        fullPath,
        `illegal object ${fullPath}`
      );
    }

    const fullPath = obj.fullPath;
    let create = false;
    try {
      obj = await this.doGetObject(fullPath, content != null);
    } catch (e) {
      if (e instanceof NotFoundError) {
        create = true;
      } else if (e instanceof AbstractFileError) {
        throw e;
      } else {
        throw new NotReadableError(this.name, fullPath, e);
      }
    }

    if (create) {
      await this.beforePost(obj);
    } else {
      await this.beforePut(obj);
    }

    obj = await this.doPutObject(obj, content);

    if (create) {
      this.afterPost(obj);
    } else {
      this.afterPut(obj);
    }

    return obj;
  }

  public async putText(
    obj: FileSystemObject,
    text: string
  ): Promise<FileSystemObject> {
    const u8 = textToUint8Array(text);
    return this.putObject(obj, u8);
  }

  public async readContent(
    obj: FileSystemObject,
    type?: DataType
  ): Promise<Blob | BufferSource | string> {
    if (isIllegalObject(obj, this.options.index)) {
      const fullPath = obj.fullPath;
      throw new InvalidModificationError(
        this.name,
        fullPath,
        `illegal object ${fullPath}`
      );
    }

    const fullPath = obj.fullPath;
    this.debug("readContent", fullPath);
    if (!(await this.beforeGet(obj))) {
      throw new NotFoundError(this.name, obj.fullPath, "beforeGet");
    }
    const content = await this.readContentInternal(obj, type);
    this.afterGet(obj);
    return content;
  }

  public async readContentInternal(
    obj: FileSystemObject,
    type?: DataType
  ): Promise<Blob | BufferSource | string> {
    const fullPath = obj.fullPath;
    let content: string | Blob | BufferSource;
    if (this.contentsCache) {
      content = this.contentsCache.get(fullPath);
    }
    let read = false;
    if (!content) {
      try {
        content = await this.doReadContent(fullPath);
      } catch (e) {
        await this.handleReadError(e, fullPath, true);
      }
      read = true;
    }
    if (type === "blob") {
      content = toBlob(content);
    } else if (type === "buffer") {
      content = await toBuffer(content);
    } else if (type === "arraybuffer") {
      content = await toArrayBuffer(content);
    } else if (type === "base64") {
      content = await toBase64(content);
    }
    if (this.contentsCache && read) {
      this.contentsCache.put(obj, content);
    }
    return content;
  }

  public async readText(obj: FileSystemObject): Promise<string> {
    const content = await this.readContent(obj);
    const text = await toText(content);
    return text;
  }

  public async remove(obj: FileSystemObject) {
    const fullPath = obj.fullPath;
    if (fullPath === DIR_SEPARATOR) {
      throw new InvalidModificationError(
        this.name,
        fullPath,
        "cannot remove root dir"
      );
    }

    const index = this.options.index;
    if (index && fullPath.startsWith(INDEX_DIR_PATH + "/")) {
      throw new InvalidModificationError(
        this.name,
        fullPath,
        `cannot remove index dir`
      );
    }

    const isFile = obj.size != null;
    if (!isFile) {
      // Directory
      try {
        const objects = await this.getObjects(fullPath);
        if (0 < objects.length) {
          throw new InvalidModificationError(
            this.name,
            fullPath,
            `directory is not empty - ${objects
              .map((obj) => obj.fullPath)
              .toString()}`
          );
        }
      } catch (e) {
        if (e instanceof NotFoundError) {
          await this.handleNotFoundError(fullPath, false);
          return;
        }
        await this.handleReadError(e, fullPath, false);
      }
    }

    this.debug("remove", fullPath);
    await this.beforeDelete(obj);

    await this.delete(fullPath, isFile, false);

    this.afterDelete(obj);
  }

  public async removeRecursively(obj: FileSystemObject) {
    const fullPath = obj.fullPath;
    let children: FileSystemObject[];
    try {
      children = await this.getObjects(fullPath);
    } catch (e) {
      if (e instanceof NotFoundError) {
        await this.handleNotFoundError(fullPath, false);
        return;
      }
      await this.handleReadError(e, fullPath, false);
    }

    for (const child of children) {
      if (child.size == null) {
        await this.removeRecursively(child);
      } else {
        await this.remove(child);
      }
    }
    if (fullPath !== DIR_SEPARATOR) {
      await this.remove(obj);
    }
  }

  public async saveRecord(fullPath: string, record: Record) {
    if (!this.options.index) {
      return;
    }

    try {
      const indexPath = await this.createIndexPath(fullPath, true);
      await this.doSaveRecord(indexPath, record);

      const indexObj = await this.doGetObject(indexPath, true);
      this.recordCache[indexPath] = {
        record,
        lastModified: indexObj.lastModified,
      };

      return record;
    } catch (e) {
      await this.handleWriteError(e, fullPath, true);
    }
  }

  public async truncateRecord(fullPath: string) {
    if (!this.options.index) {
      return;
    }
    if (fullPath === INDEX_DIR_PATH) {
      return;
    }

    const indexPath = await this.createIndexPath(fullPath, false);
    try {
      await this.doDelete(indexPath, true);
    } catch (e) {
      onError(e);
    }
    delete this.recordCache[indexPath];
  }

  public abstract doDelete(fullPath: string, isFile: boolean): Promise<void>;
  public abstract doGetObject(
    fullPath: string,
    isFile: boolean
  ): Promise<FileSystemObject>;
  public abstract doGetObjects(dirPath: string): Promise<FileSystemObject[]>;
  public abstract doMakeDirectory(fullPath: string): Promise<void>;
  public abstract doReadContent(
    fullPath: string
  ): Promise<Blob | BufferSource | string>;

  protected debug(title: string, value: string | FileSystemObject) {
    if (!this.options.verbose) {
      return;
    }
    if (typeof value === "string") {
      console.debug(`${this.name} - ${title}: fullPath=${value}`);
    } else {
      console.debug(
        `${this.name} - ${title}: fullPath=${value.fullPath}, lastModified=${value.lastModified}, size=${value.size}`
      );
    }
  }

  protected async doSaveRecord(indexPath: string, record: Record) {
    const text = objectToText(record);
    const u8 = textToUint8Array(text);
    await this.doWriteContent(indexPath, u8);
  }

  protected async doWriteUint8Array(
    fullPath: string,
    view: Uint8Array
  ): Promise<void> {
    const buffer = await toArrayBuffer(view);
    await this.doWriteArrayBuffer(fullPath, buffer);
  }

  protected async handleNotFoundError(fullPath: string, isFile: boolean) {
    if (fullPath.startsWith(INDEX_DIR_PATH + "/")) {
      return;
    }

    await this.deleteRecord(fullPath, isFile);
    if (isFile) {
      this.clearContentsCache(fullPath);
    }
  }

  protected async handleReadError(e: any, fullPath: string, isFile: boolean) {
    if (e instanceof NotFoundError) {
      await this.handleNotFoundError(fullPath, isFile);
      throw e;
    } else if (e instanceof AbstractFileError) {
      throw e;
    }
    throw new NotReadableError(this.name, fullPath, e);
  }

  protected async handleWriteError(e: any, fullPath: string, isFile: boolean) {
    if (e instanceof NotFoundError) {
      await this.handleNotFoundError(fullPath, isFile);
      throw e;
    } else if (e instanceof AbstractFileError) {
      throw e;
    }
    throw new InvalidModificationError(this.name, fullPath, e);
  }

  protected initialize(options: FileSystemOptions) {
    this.initializeIndexOptions(options);

    if (options.contentsCache == null) {
      options.contentsCache = true;
    }
    this.initializeContentsCacheOptions(options);

    this.debug("AbstractAccessor#initialize", JSON.stringify(options));
  }

  protected initializeContentsCacheOptions(options: FileSystemOptions) {
    if (!options.contentsCache) {
      return;
    }

    if (options.contentsCacheOptions == null) {
      options.contentsCacheOptions = {};
    }
    const contentsCacheOptions = options.contentsCacheOptions;
    if (!(0 < contentsCacheOptions.capacity)) {
      contentsCacheOptions.capacity = 100 * 1024 * 1024; // 100MB
    }
    if (!(0 < contentsCacheOptions.limitSize)) {
      contentsCacheOptions.limitSize = 256 * 1024; // 256KB;
    }
    if (contentsCacheOptions.capacity < contentsCacheOptions.limitSize) {
      contentsCacheOptions.limitSize = contentsCacheOptions.capacity;
    }

    this.contentsCache = new ContentsCache(this);
  }

  protected initializeIndexOptions(options: FileSystemOptions) {
    if (!options.index) {
      return;
    }

    if (options.indexOptions == null) {
      options.indexOptions = {};
    }

    const indexOptions = options.indexOptions;
    if (indexOptions.noCache == null) {
      indexOptions.noCache = false;
    }
    if (indexOptions.logicalDelete == null) {
      indexOptions.logicalDelete = false;
    }
  }

  protected abstract doWriteArrayBuffer(
    fullPath: string,
    buffer: ArrayBuffer
  ): Promise<void>;
  protected abstract doWriteBase64(
    fullPath: string,
    base64: string
  ): Promise<void>;
  protected abstract doWriteBlob(fullPath: string, blob: Blob): Promise<void>;
  protected abstract doWriteBuffer(
    fullPath: string,
    buffer: Buffer
  ): Promise<void>;

  private afterDelete(obj: FileSystemObject) {
    if (!this.options.event.postDelete) {
      return;
    }
    this.options.event.postDelete(obj);
  }

  private afterGet(obj: FileSystemObject) {
    if (!this.options.event.postGet) {
      return;
    }
    this.options.event.postHead(obj);
  }

  private afterHead(obj: FileSystemObject) {
    if (!this.options.event.postHead) {
      return;
    }
    this.options.event.postHead(obj);
  }

  private afterPost(obj: FileSystemObject) {
    if (!this.options.event.postPost) {
      return;
    }
    this.options.event.postPost(obj);
  }

  private afterPut(obj: FileSystemObject) {
    if (!this.options.event.postPut) {
      return;
    }
    this.options.event.postPut(obj);
  }

  // TODO 親フォルダ
  private async beforeDelete(obj: FileSystemObject) {
    if (!this.options.event.preDelete) {
      return;
    }

    const result = await this.options.event.preDelete(obj);
    if (!result) {
      throw new NoModificationAllowedError(
        this.name,
        obj.fullPath,
        "beforeDelete"
      );
    }
  }

  // TODO 親フォルダ
  private async beforeGet(obj: FileSystemObject) {
    if (!this.options.event.preGet) {
      return true;
    }

    return this.options.event.preGet(obj);
  }

  private async beforeHead(obj: FileSystemObject) {
    if (!this.options.event.preHead) {
      return true;
    }

    return this.options.event.preHead(obj);
  }

  private async beforePost(obj: FileSystemObject) {
    if (!this.options.event.prePost) {
      return;
    }

    const result = await this.options.event.prePost(obj);
    if (!result) {
      throw new NoModificationAllowedError(
        this.name,
        obj.fullPath,
        "beforePost"
      );
    }
  }

  private async beforePut(obj: FileSystemObject) {
    if (!this.options.event.prePut) {
      return;
    }

    const result = await this.options.event.prePut(obj);
    if (!result) {
      throw new NoModificationAllowedError(
        this.name,
        obj.fullPath,
        "beforePut"
      );
    }
  }
}
