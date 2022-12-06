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
  INDEX_DIR_NAME,
  INDEX_DIR_PATH,
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
  protected indexDirCreated = false;
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

  public async createIndexPath(fullPath: string) {
    if (!this.indexDirCreated) {
      await this.makeDirectory(INDEX_DIR_PATH);
      this.indexDirCreated = true;
    }
    const name = getName(fullPath);
    const parentPath = getParentPath(fullPath);
    const indexName = "_" + name;
    let indexDir = INDEX_DIR_PATH + parentPath;
    if (!indexDir.endsWith(DIR_SEPARATOR)) {
      indexDir += DIR_SEPARATOR;
    }
    await this.makeDirectory(indexDir);
    const indexPath = indexDir + indexName;
    return indexPath;
  }

  public async createRecord(obj: FileSystemObject) {
    const fullPath = obj.fullPath;
    const lastModified = obj.lastModified;
    const size = obj.size;
    let record: Record;
    try {
      record = await this.getRecord(fullPath);
      if (record.modified === lastModified) {
        return record;
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

  public async delete(fullPath: string, isFile: boolean) {
    try {
      await this.deleteRecord(fullPath);
    } catch (e) {
      onError(e);
    }

    if (!this.options.indexOptions?.logicalDelete) {
      try {
        await this.doDelete(fullPath, isFile);
      } catch (e) {
        onError(e);
      }
    }

    if (isFile && this.contentsCache) {
      this.contentsCache.remove(fullPath);
    }
  }

  public async deleteRecord(fullPath: string, record?: Record) {
    if (!this.options.index) {
      return;
    }
    if (fullPath === INDEX_DIR_PATH) {
      return;
    }

    const entry = this.recordCache[fullPath];
    if (!record) {
      if (entry) {
        if (entry.record.deleted != null) {
          return;
        }
        record = entry.record;
      } else {
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
      }
    }
    if (record.deleted == null) {
      record.deleted = Date.now();
    }

    const indexPath = await this.createIndexPath(fullPath);
    await this.doSaveRecord(indexPath, record);

    const indexObj = await this.doGetObject(indexPath);
    this.recordCache[indexPath] = {
      record,
      lastModified: indexObj.lastModified,
    };
  }

  public async deleteRecursively(fullPath: string) {
    try {
      var children = await this.doGetObjects(fullPath);
    } catch (e) {
      if (!(e instanceof NotFoundError)) {
        onError(e);
      }
      return;
    }

    for (const child of children) {
      if (child.size == null) {
        await this.deleteRecursively(child.fullPath);
      } else {
        await this.delete(child.fullPath, true);
      }
    }
    if (fullPath !== DIR_SEPARATOR) {
      await this.delete(fullPath, false);
    }
  }

  public async doPutObject(
    obj: FileSystemObject,
    content?: Blob | BufferSource | string
  ): Promise<FileSystemObject> {
    const fullPath = obj.fullPath;
    try {
      this.debug("putObject", fullPath);
      if (content == null) {
        // Directory
        await this.makeDirectory(obj.fullPath);
      } else {
        // File
        await this.doWriteContent(fullPath, content);
        try {
          obj = await this.doGetObject(fullPath);
        } catch (e) {
          console.warn("putObject", fullPath, e);
        }
        if (this.contentsCache) {
          this.contentsCache.put(obj, content);
        }
      }
      const record = await this.createRecord(obj);
      await this.saveRecord(obj.fullPath, record);
      return obj;
    } catch (e) {
      if (e instanceof AbstractFileError) {
        throw e;
      }
      throw new InvalidModificationError(this.name, fullPath, e);
    }
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
      if (e instanceof AbstractFileError) {
        throw e;
      }
      throw new InvalidModificationError(this.name, fullPath, e);
    }
  }

  public async getFileNameIndex(dirPath: string) {
    if (!this.indexDirCreated) {
      await this.makeDirectory(INDEX_DIR_PATH);
      this.indexDirCreated = true;
    }

    const fileNameIndex: FileNameIndex = {};
    if (dirPath === INDEX_DIR_PATH) {
      return fileNameIndex;
    }

    let indexDir = INDEX_DIR_PATH + (dirPath === DIR_SEPARATOR ? "" : dirPath);
    const objects = await this.doGetObjects(indexDir);

    if (!dirPath.endsWith("/")) {
      dirPath += "/";
    }

    for (const obj of objects) {
      try {
        const name = obj.name.substring(1);
        const fullPath = dirPath + name;
        if (fullPath === INDEX_DIR_PATH) {
          continue;
        }
        const record = await this.getRecord(fullPath);
        fileNameIndex[name] = { ...record, fullPath, name };
      } catch (e) {
        if (e instanceof NotFoundError) {
        } else {
          onError(e);
        }
      }
    }

    return fileNameIndex;
  }

  public async getObject(fullPath: string, _isFile: boolean) {
    this.debug("getObject", fullPath);

    let record: Record;
    if (this.options.index) {
      try {
        record = await this.getRecord(fullPath);
        if (record.deleted != null) {
          throw new NotFoundError(this.name, fullPath, "getObject");
        }
      } catch (e) {
        if (e instanceof AbstractFileError) {
          throw e;
        } else {
          throw new NotReadableError(this.name, fullPath, e);
        }
      }
    }

    try {
      var obj = await this.doGetObject(fullPath);
      if (record && record.modified !== obj.lastModified) {
        record.modified = obj.lastModified;
        record.size = obj.size;
        await this.saveRecord(fullPath, record);
      }
    } catch (e) {
      await this.handleReadError(e, fullPath);
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
      let objects = await this.doGetObjects(dirPath);

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
                await this.saveRecord(obj.fullPath, record);
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
      if (e instanceof NotFoundError) {
        await this.handleReadError(e, dirPath);
      } else if (e instanceof AbstractFileError) {
        throw e;
      }
      throw new NotReadableError(this.name, dirPath, e);
    }
  }

  public async getRecord(fullPath: string) {
    const indexPath = await this.createIndexPath(fullPath);
    const indexObj = await this.doGetObject(indexPath);
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

  public async getURL(
    fullPath: string,
    method?: "GET" | "POST" | "PUT" | "DELETE"
  ): Promise<string> {
    return null;
  }

  public async makeDirectory(fullPath: string) {
    try {
      await this.doGetObject(fullPath);
    } catch (e) {
      if (e instanceof NotFoundError) {
        await this.doMakeDirectory(fullPath);
      } else {
        throw new NotReadableError(this.name, fullPath, e);
      }
    }
  }

  public async purge() {
    await this.deleteRecursively(DIR_SEPARATOR);
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
      obj = await this.doGetObject(fullPath);
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
    if (this.contentsCache) {
      var content = await this.contentsCache.get(fullPath);
    }
    if (!content) {
      try {
        content = await this.doReadContent(fullPath);
      } catch (e) {
        await this.handleReadError(e, fullPath, obj.name);
      }
      var read = true;
    }
    if (type === "blob") {
      content = await toBlob(content);
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
    if (index && fullPath.startsWith(INDEX_DIR_PATH)) {
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
            `directory is not empty - ${objects.map((obj) => obj.fullPath)}`
          );
        }
      } catch (e) {
        if (!(e instanceof NotFoundError)) {
          onError(e);
        }
        return;
      }
    }

    this.debug("remove", fullPath);
    await this.beforeDelete(obj);

    await this.delete(fullPath, isFile);

    this.afterDelete(obj);
  }

  public async removeRecursively(obj: FileSystemObject) {
    const fullPath = obj.fullPath;
    try {
      var children = await this.getObjects(fullPath);
    } catch (e) {
      if (!(e instanceof NotFoundError)) {
        onError(e);
      }
      return;
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

    const indexPath = await this.createIndexPath(fullPath);
    await this.doSaveRecord(indexPath, record);

    const indexObj = await this.doGetObject(indexPath);
    this.recordCache[indexPath] = {
      record,
      lastModified: indexObj.lastModified,
    };

    return record;
  }

  public abstract doDelete(fullPath: string, isFile: boolean): Promise<void>;
  public abstract doGetObject(fullPath: string): Promise<FileSystemObject>;
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

  private async handleReadError(e: any, fullPath: string, name?: string) {
    if (e instanceof NotFoundError) {
      await this.deleteRecord(fullPath);
      this.clearContentsCache(fullPath);
      throw e;
    } else if (e instanceof AbstractFileError) {
      throw e;
    }
    throw new NotReadableError(this.name, fullPath, e);
  }
}
