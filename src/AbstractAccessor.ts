import { toArrayBuffer, toBase64, toBlob } from "./BinaryConverter";
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
  INDEX_DIR,
  INDEX_FILE_NAME,
} from "./FileSystemConstants";
import { DirPathIndex, FileNameIndex } from "./FileSystemIndex";
import { FileSystemObject } from "./FileSystemObject";
import { FileSystemOptions } from "./FileSystemOptions";
import {
  getName,
  getParentPath,
  isIllegalObject,
  onError,
} from "./FileSystemUtil";
import { objectToText, textToObject } from "./ObjectUtil";
import { textToArrayBuffer, toText } from "./TextConverter";

export abstract class AbstractAccessor {
  // #region Properties (5)

  private static INDEX_NOT_FOUND: any = null;

  protected contentsCache: ContentsCache;

  public abstract readonly filesystem: FileSystem;
  public abstract readonly name: string;

  public dirPathIndex: DirPathIndex = {};

  // #endregion Properties (5)

  // #region Constructors (1)

  constructor(public readonly options: FileSystemOptions) {
    this.initialize(options);
  }

  // #endregion Constructors (1)

  // #region Public Methods (21)

  public async clearContentsCache(fullPath: string) {
    if (this.contentsCache == null) {
      return;
    }
    this.contentsCache.remove(fullPath);
  }

  public async clearFileNameIndex(dirPath: string) {
    delete this.dirPathIndex[dirPath];
  }

  public createIndexDir(dirPath: string) {
    let indexDir = INDEX_DIR + dirPath;
    if (!indexDir.endsWith(DIR_SEPARATOR)) {
      indexDir += DIR_SEPARATOR;
    }
    return indexDir;
  }

  public createIndexPath(dirPath: string) {
    const indexDir = this.createIndexDir(dirPath);
    return indexDir + INDEX_FILE_NAME;
  }

  public async delete(fullPath: string, isFile: boolean) {
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

  public async doDeleteRecursively(fullPath: string) {
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
        await this.doDeleteRecursively(child.fullPath);
        await this.doDelete(child.fullPath, false);
      } else {
        await this.doDelete(child.fullPath, true);
      }
    }
  }

  public async doGetFileNameIndex(dirPath: string) {
    const indexPath = this.createIndexPath(dirPath);
    const content = await this.doReadContent(indexPath);
    const text = await toText(content);
    if (!text) {
      throw new NotFoundError(this.name, dirPath, "doLoadFileNameIndex");
    }
    const fileNameIndex = textToObject(text) as FileNameIndex;
    if (!fileNameIndex) {
      return {} as FileNameIndex;
    }
    return fileNameIndex;
  }

  public async doWriteContent(
    fullPath: string,
    content: Blob | Uint8Array | ArrayBuffer | string
  ) {
    try {
      if (typeof content === "string") {
        await this.doWriteBase64(fullPath, content);
      } else if (content instanceof Blob) {
        await this.doWriteBlob(fullPath, content);
      } else if (ArrayBuffer.isView(content)) {
        await this.doWriteUint8Array(fullPath, content);
      } else {
        await this.doWriteArrayBuffer(fullPath, content);
      }

      return this.doGetObject(fullPath);
    } catch (e) {
      if (e instanceof AbstractFileError) {
        throw e;
      }
      throw new InvalidModificationError(this.name, fullPath, e);
    }
  }

  public async getFileNameIndex(dirPath: string) {
    let fileNameIndex: FileNameIndex;

    const noCache = this.options.indexOptions.noCache;
    if (!noCache) {
      fileNameIndex = this.dirPathIndex[dirPath];
    }

    if (typeof fileNameIndex === "undefined") {
      try {
        fileNameIndex = await this.doGetFileNameIndex(dirPath);
        this.dirPathIndex[dirPath] = fileNameIndex;
      } catch (e) {
        if (!(e instanceof NotFoundError)) {
          throw e;
        }
      }
    }

    if (fileNameIndex === AbstractAccessor.INDEX_NOT_FOUND) {
      throw new NotFoundError(this.name, dirPath, "getFileNameIndex");
    }

    if (typeof fileNameIndex === "undefined") {
      try {
        var objects = await this.doGetObjects(dirPath);
      } catch (e) {
        if (!(e instanceof NotFoundError)) {
          throw e;
        }
        this.dirPathIndex[dirPath] = AbstractAccessor.INDEX_NOT_FOUND;
        throw new NotFoundError(this.name, dirPath, "getFileNameIndex");
      }

      fileNameIndex = {};

      let updated = false;
      for (const obj of objects) {
        if (isIllegalObject(obj)) {
          continue;
        }

        const name = obj.name;
        const record = fileNameIndex[name];
        if (record) {
          if (record.deleted && !this.options.indexOptions?.logicalDelete) {
            delete record.deleted;
            updated = true;
          }
          continue;
        }

        updated = true;
        fileNameIndex[name] = {
          modified: obj.lastModified || Date.now(),
          obj,
        };
      }

      if (updated) {
        this.dirPathIndex[dirPath] = fileNameIndex;
        await this.saveFileNameIndex(dirPath);
      }
    }

    return fileNameIndex;
  }

  public async getFileNameIndexObject(dirPath: string) {
    const indexPath = this.createIndexPath(dirPath);
    return this.doGetObject(indexPath);
  }

  public async getObject(fullPath: string, isFile: boolean) {
    this.debug("getObject", fullPath);

    try {
      var obj = await this.doGetObject(fullPath);
    } catch (e) {
      await this.handleReadError(e, fullPath);
    }

    if (!(await this.beforeHead(obj))) {
      throw new NotFoundError(this.name, obj.fullPath, "beforeHead");
    }

    if (this.options.index) {
      let updated = false;
      let { record, fileNameIndex } = await this.getRecord(fullPath);
      if (record) {
        if (record.deleted) {
          if (this.options.indexOptions?.logicalDelete) {
            throw new NotFoundError(this.name, obj.fullPath, "logicalDelete");
          } else {
            updated = true;
            record = { modified: obj.lastModified || Date.now(), obj };
          }
        }
      } else {
        updated = true;
        record = { modified: obj.lastModified || Date.now(), obj };
      }

      if (updated) {
        fileNameIndex[obj.name] = record;
        const dirPath = getParentPath(fullPath);
        await this.saveFileNameIndex(dirPath);
      }
    }

    this.afterHead(obj);
    return obj;
  }

  public async getObjects(dirPath: string) {
    try {
      const index = this.options.index;
      let objects: FileSystemObject[];
      if (index) {
        var fileNameIndex = await this.getFileNameIndex(dirPath);
        objects = Object.values(fileNameIndex).map((record) => record.obj);
      } else {
        objects = await this.doGetObjects(dirPath);
      }
      const newObjects: FileSystemObject[] = [];

      for (const obj of objects) {
        if (isIllegalObject(obj)) {
          continue;
        }

        if (index) {
          var name = obj.name;
          var record = fileNameIndex[name];
          if (record && record.deleted) {
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
    } catch (e) {
      if (e instanceof AbstractFileError) {
        throw e;
      }
      throw new NotReadableError(this.name, dirPath, e);
    }
  }

  public async putObject(
    obj: FileSystemObject,
    content?: Blob | Uint8Array | ArrayBuffer | string
  ): Promise<FileSystemObject> {
    if (isIllegalObject(obj)) {
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

    try {
      this.debug("putObject", fullPath);
      if (content == null) {
        // Directory
        await this.makeDirectory(obj);
      } else {
        // File
        obj = await this.doWriteContent(fullPath, content);
        if (this.contentsCache) {
          this.contentsCache.put(obj, content);
        }
      }
      if (this.options.index) {
        await this.updateIndex(obj);
      }
    } catch (e) {
      if (e instanceof AbstractFileError) {
        throw e;
      }
      throw new InvalidModificationError(this.name, fullPath, e);
    }

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
    const buffer = textToArrayBuffer(text);
    return this.putObject(obj, buffer);
  }

  public async readContent(
    obj: FileSystemObject,
    type?: DataType
  ): Promise<Blob | Uint8Array | ArrayBuffer | string> {
    if (isIllegalObject(obj)) {
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
  ): Promise<Blob | Uint8Array | ArrayBuffer | string> {
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
      content = toBlob(content);
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
    if (index && fullPath.startsWith(INDEX_DIR)) {
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

    if (this.options.index) {
      await this.deleteFromIndex(fullPath);
    }
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
      }
      await this.remove(child);
    }
    if (fullPath !== DIR_SEPARATOR) {
      await this.remove(obj);
    }
  }

  public async saveFileNameIndex(dirPath: string) {
    const fileNameIndex = this.dirPathIndex[dirPath];
    const text = objectToText(fileNameIndex);
    const buffer = textToArrayBuffer(text);
    const indexPath = this.createIndexPath(dirPath);
    this.debug("saveFileNameIndex", indexPath);
    await this.doWriteContent(indexPath, buffer);
    return { indexPath, buffer };
  }

  public async updateIndex(obj: FileSystemObject) {
    const fullPath = obj.fullPath;
    const dirPath = getParentPath(fullPath);
    const fileNameIndex = await this.getFileNameIndex(dirPath);
    const name = getName(fullPath);
    fileNameIndex[name] = { modified: obj.lastModified || Date.now(), obj };
    this.dirPathIndex[dirPath] = fileNameIndex;
    await this.saveFileNameIndex(dirPath);
  }

  // #endregion Public Methods (21)

  // #region Public Abstract Methods (5)

  public abstract doDelete(fullPath: string, isFile: boolean): Promise<void>;
  public abstract doGetObject(fullPath: string): Promise<FileSystemObject>;
  public abstract doGetObjects(dirPath: string): Promise<FileSystemObject[]>;
  public abstract doMakeDirectory(obj: FileSystemObject): Promise<void>;
  public abstract doReadContent(
    fullPath: string
  ): Promise<Blob | Uint8Array | ArrayBuffer | string>;

  // #endregion Public Abstract Methods (5)

  // #region Protected Methods (8)

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

  protected async deleteFromIndex(fullPath: string) {
    if (!this.options.index) {
      return;
    }

    const dirPath = getParentPath(fullPath);
    try {
      var fileNameIndex = await this.getFileNameIndex(dirPath);
    } catch (e) {
      if (e instanceof NotFoundError) {
        return;
      }
      throw e;
    }

    const name = getName(fullPath);
    const record = fileNameIndex[name];
    if (!record) {
      return;
    }
    record.deleted = Date.now();
    this.dirPathIndex[dirPath] = fileNameIndex;
    await this.saveFileNameIndex(dirPath);
  }

  protected async doWriteUint8Array(
    fullPath: string,
    view: Uint8Array
  ): Promise<void> {
    const buffer = await toArrayBuffer(view);
    await this.doWriteArrayBuffer(fullPath, buffer);
  }

  protected async getRecord(fullPath: string) {
    const dirPath = getParentPath(fullPath);
    const name = getName(fullPath);
    try {
      const fileÑameIndex = await this.getFileNameIndex(dirPath);
      return { record: fileÑameIndex[name], fileNameIndex: fileÑameIndex };
    } catch (e) {
      return { record: null, fileNameIndex: {} };
    }
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
      contentsCacheOptions.capacity = 10 * 1024 * 1024; // 10MB
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

  protected async makeDirectory(obj: FileSystemObject) {
    this.debug("makeDirectory", obj);
    await this.doMakeDirectory(obj);
  }

  // #endregion Protected Methods (8)

  // #region Protected Abstract Methods (3)

  protected abstract doWriteArrayBuffer(
    fullPath: string,
    buffer: ArrayBuffer
  ): Promise<void>;
  protected abstract doWriteBase64(
    fullPath: string,
    base64: string
  ): Promise<void>;
  protected abstract doWriteBlob(fullPath: string, blob: Blob): Promise<void>;

  // #endregion Protected Abstract Methods (3)

  // #region Private Methods (11)

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
      if (this.options.index) {
        let { record, fileNameIndex } = await this.getRecord(fullPath);
        if (record && !record.deleted) {
          if (name == null) {
            name = getName(fullPath);
          }
          delete fileNameIndex[name];
          const dirPath = getParentPath(fullPath);
          await this.saveFileNameIndex(dirPath);
        }
      }
      throw e;
    } else if (e instanceof AbstractFileError) {
      throw e;
    } else {
      throw new NotReadableError(this.name, fullPath, e);
    }
  }

  // #endregion Private Methods (11)
}
