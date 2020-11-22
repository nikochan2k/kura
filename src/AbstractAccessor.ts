import { toArrayBuffer, toBase64, toBlob } from "./BinaryConverter";
import { ContentsCache } from "./ContentsCache";
import {
  AbstractFileError,
  InvalidModificationError,
  NoModificationAllowedError,
  NotFoundError,
  NotImplementedError,
  NotReadableError,
} from "./FileError";
import { DataType, FileSystem } from "./filesystem";
import {
  DIR_SEPARATOR,
  INDEX_DIR,
  INDEX_FILE_NAME,
} from "./FileSystemConstants";
import { DirPathIndex, FileNameIndex, Record } from "./FileSystemIndex";
import { FileSystemObject } from "./FileSystemObject";
import { FileSystemOptions } from "./FileSystemOptions";
import {
  getName,
  getParentPath,
  isIllegalFileName,
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

  // #region Public Methods (23)

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
    if (this.options.index) {
      await this.deleteFromIndex(fullPath);
    }
    if (isFile && this.contentsCache) {
      this.contentsCache.remove(fullPath);
    }
  }

  public async deleteRecursively(fullPath: string) {
    const objects = await this.doGetObjects(fullPath);
    for (const obj of objects) {
      if (obj.fullPath === DIR_SEPARATOR) {
        continue;
      }

      if (obj.size == null) {
        await this.deleteRecursively(obj.fullPath);
        continue;
      }
      await this.delete(obj.fullPath, true);
    }
    if (fullPath !== DIR_SEPARATOR) {
      await this.delete(fullPath, false);
    }
  }

  public async doGetFileNameIndex(dirPath: string) {
    const indexPath = this.createIndexPath(dirPath);
    const content = await this.doReadContent(indexPath);
    const text = await toText(content);
    if (!text) {
      throw new NotFoundError(this.name, dirPath, "doLoadFileNameIndex");
    }
    return textToObject(text) as FileNameIndex;
  }

  public async doWriteContent(
    fullPath: string,
    content: Blob | Uint8Array | ArrayBuffer | string
  ) {
    if (typeof content === "string") {
      await this.doWriteBase64(fullPath, content);
    } else if (content instanceof Blob) {
      await this.doWriteBlob(fullPath, content);
    } else if (ArrayBuffer.isView(content)) {
      await this.doWriteUint8Array(fullPath, content);
    } else {
      await this.doWriteArrayBuffer(fullPath, content);
    }
  }

  public async getFileNameIndex(dirPath: string) {
    let fileNameIndex = this.dirPathIndex[dirPath];
    if (fileNameIndex === AbstractAccessor.INDEX_NOT_FOUND) {
      throw new NotFoundError(this.name, dirPath, "getFileNameIndex");
    } else if (typeof fileNameIndex === "undefined") {
      try {
        fileNameIndex = await this.doGetFileNameIndex(dirPath);
      } catch (e) {
        if (!(e instanceof NotFoundError)) {
          throw e;
        }
        try {
          var objects = await this.doGetObjects(dirPath);
        } catch (e2) {
          if (!(e2 instanceof NotFoundError)) {
            throw e2;
          }
          this.dirPathIndex[dirPath] = AbstractAccessor.INDEX_NOT_FOUND;
          throw new NotFoundError(this.name, dirPath, "getFileNameIndex");
        }
        if (dirPath === DIR_SEPARATOR) {
          fileNameIndex = {
            "": {
              modified: 0,
            },
          };
        } else {
          fileNameIndex = {};
        }
        for (const obj of objects) {
          fileNameIndex[obj.name] = {
            modified: obj.lastModified || Date.now(),
          };
        }
        this.dirPathIndex[dirPath] = fileNameIndex;
        await this.saveFileNameIndex(dirPath);
      }
      this.dirPathIndex[dirPath] = fileNameIndex;
    }
    return fileNameIndex;
  }

  public async getFileNameIndexObject(dirPath: string) {
    const indexPath = this.createIndexPath(dirPath);
    return this.doGetObject(indexPath);
  }

  public async getObject(fullPath: string, isFile: boolean) {
    this.debug("getObject", fullPath);

    const name = getName(fullPath);
    try {
      var obj = await this.doGetObject(fullPath);
    } catch (e) {
      if (e instanceof NotFoundError) {
        if (this.options.index) {
          let { record, fileNameIndex } = await this.getRecord(fullPath);
          if (record && !record.deleted) {
            record.deleted = Date.now();
            fileNameIndex[name] = record;
            const dirPath = getParentPath(fullPath);
            await this.saveFileNameIndex(dirPath);
          }
        }
        throw e;
      } else if (e instanceof AbstractFileError) {
        throw e;
      }
      throw new NotReadableError(this.name, fullPath, e);
    }

    if (!(await this.beforeHead(obj))) {
      throw new NotFoundError(this.name, obj.fullPath, "beforeHead");
    }

    if (this.options.index) {
      const { record, fileNameIndex } = await this.getRecord(fullPath);
      const newRecord = await this.validateRecord(obj, record);
      if (newRecord) {
        fileNameIndex[obj.name] = newRecord;
        const dirPath = getParentPath(fullPath);
        await this.saveFileNameIndex(dirPath);
      }
    }

    this.afterHead(obj);
    return obj;
  }

  public async getObjects(dirPath: string) {
    try {
      const objects = await this.doGetObjects(dirPath);
      const newObjects: FileSystemObject[] = [];

      const index = this.options.index;
      if (index) {
        var fileNameIndex = await this.getFileNameIndex(dirPath);
        var updated = false;
      }

      for (const obj of objects) {
        if (index) {
          if (obj.fullPath.startsWith(INDEX_DIR)) {
            continue;
          }

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

        if (index) {
          const newRecord = await this.validateRecord(obj, record);
          if (newRecord) {
            fileNameIndex[name] = newRecord;
            updated = true;
          }
        }

        newObjects.push(obj);
      }

      if (updated) {
        await this.saveFileNameIndex(dirPath);
      }

      return newObjects;
    } catch (e) {
      if (e instanceof AbstractFileError) {
        throw e;
      }
      throw new NotReadableError(this.name, dirPath, e);
    }
  }

  public async getRecord(fullPath: string) {
    const dirPath = getParentPath(fullPath);
    const name = getName(fullPath);
    const fileÑameIndex = await this.getFileNameIndex(dirPath);
    return { record: fileÑameIndex[name], fileNameIndex: fileÑameIndex };
  }

  public async putObject(
    obj: FileSystemObject,
    content?: Blob | Uint8Array | ArrayBuffer | string
  ): Promise<FileSystemObject> {
    const name = obj.name;
    const fullPath = obj.fullPath;
    if (fullPath === DIR_SEPARATOR) {
      throw new InvalidModificationError(
        this.name,
        fullPath,
        "cannot write to root dir"
      );
    }
    if (isIllegalFileName(name)) {
      throw new InvalidModificationError(
        this.name,
        obj.fullPath,
        `illegal file name "${name}"`
      );
    }
    if (this.options.index && fullPath.startsWith(INDEX_DIR)) {
      throw new InvalidModificationError(
        this.name,
        fullPath,
        "cannot write to index dir"
      );
    }

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
      if (content == null) {
        // Directory
        await this.makeDirectory(obj);
      } else {
        // File
        obj = await this.writeContent(fullPath, content);
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
    if (isIllegalFileName(obj.name)) {
      throw new NotReadableError(
        this.name,
        obj.fullPath,
        `illegal file name "${obj.name}"`
      );
    }

    const fullPath = obj.fullPath;
    try {
      this.debug("readContent", fullPath);
      if (!(await this.beforeGet(obj))) {
        throw new NotFoundError(this.name, obj.fullPath, "beforeGet");
      }
      const content = await this.readContentInternal(obj, type);
      this.afterGet(obj);
      return content;
    } catch (e) {
      if (e instanceof NotFoundError) {
        if (this.options.index) {
          let { record, fileNameIndex } = await this.getRecord(fullPath);
          if (record && !record.deleted) {
            record.deleted = Date.now();
            fileNameIndex[obj.name] = record;
            const dirPath = getParentPath(fullPath);
            await this.saveFileNameIndex(dirPath);
          }
        }
        throw e;
      } else if (e instanceof AbstractFileError) {
        throw e;
      }
      throw new NotReadableError(this.name, fullPath, e);
    }
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
      content = await this.doReadContent(fullPath);
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
    if (obj.size == null) {
      // Directory
      let objects = await this.getObjects(fullPath);
      if (0 < objects.length) {
        throw new InvalidModificationError(
          this.name,
          fullPath,
          `directory is not empty ${objects.map((obj) => obj.fullPath)}`
        );
      }
    }
    if (fullPath === DIR_SEPARATOR) {
      throw new InvalidModificationError(
        this.name,
        fullPath,
        "cannot remove root dir"
      );
    }
    if (this.options.index && fullPath.startsWith(INDEX_DIR)) {
      throw new InvalidModificationError(
        this.name,
        fullPath,
        `cannot remove index dir`
      );
    }

    this.debug("remove", fullPath);
    await this.beforeDelete(obj);
    await this.delete(fullPath, obj.size != null);
    this.afterDelete(obj);
  }

  public async removeRecursively(obj: FileSystemObject) {
    const fullPath = obj.fullPath;
    const children = await this.getObjects(fullPath);
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

  public toURL(fullPath: string): string {
    throw new NotImplementedError(this.filesystem.name, fullPath, "toURL");
  }

  public async updateIndex(obj: FileSystemObject) {
    const fullPath = obj.fullPath;
    const dirPath = getParentPath(fullPath);
    const fileNameIndex = await this.getFileNameIndex(dirPath);
    const record: Record = { modified: obj.lastModified || Date.now() };
    const name = getName(fullPath);
    fileNameIndex[name] = record;
    this.dirPathIndex[dirPath] = fileNameIndex;
    await this.saveFileNameIndex(dirPath);
  }

  // #endregion Public Methods (23)

  // #region Public Abstract Methods (5)

  public abstract doDelete(fullPath: string, isFile: boolean): Promise<void>;
  public abstract doGetObject(fullPath: string): Promise<FileSystemObject>;
  public abstract doGetObjects(dirPath: string): Promise<FileSystemObject[]>;
  public abstract doMakeDirectory(obj: FileSystemObject): Promise<void>;
  public abstract doReadContent(
    fullPath: string
  ): Promise<Blob | Uint8Array | ArrayBuffer | string>;

  // #endregion Public Abstract Methods (5)

  // #region Protected Methods (9)

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
    const fileNameIndex = await this.getFileNameIndex(dirPath);
    if (!fileNameIndex) {
      return;
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

  protected initialize(options: FileSystemOptions) {
    this.initializeIndexOptions(options);

    if (options.contentsCache == null) {
      options.contentsCache = true;
    }
    this.initializeContentsCacheOptions(options);

    console.info(options);
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

    if (indexOptions.logicalDelete == null) {
      indexOptions.logicalDelete = false;
    }
  }

  protected async makeDirectory(obj: FileSystemObject) {
    this.debug("makeDirectory", obj);
    await this.doMakeDirectory(obj);
  }

  protected async refreshObject(
    fullPath: string,
    content: Blob | Uint8Array | ArrayBuffer | string
  ): Promise<FileSystemObject> {
    const obj = await this.doGetObject(fullPath);
    if (this.options.index) {
      await this.updateIndex(obj);
    }
    return obj;
  }

  protected async writeContent(
    fullPath: string,
    content: Blob | Uint8Array | ArrayBuffer | string
  ): Promise<FileSystemObject> {
    try {
      this.debug("writeContent", fullPath);
      await this.doWriteContent(fullPath, content);
      const obj = await this.refreshObject(fullPath, content);
      if (this.contentsCache) {
        this.contentsCache.put(obj, content);
      }
      return obj;
    } catch (e) {
      if (e instanceof AbstractFileError) {
        throw e;
      }
      throw new InvalidModificationError(this.name, fullPath, e);
    }
  }

  // #endregion Protected Methods (9)

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

  private async validateRecord(obj: FileSystemObject, record: Record) {
    let updated = false;
    if (record) {
      if (record.deleted) {
        if (this.options.indexOptions?.logicalDelete) {
          throw new NotFoundError(this.name, obj.fullPath, "logicalDelete");
        } else {
          record = { modified: obj.lastModified || Date.now() };
          updated = true;
        }
      }
    } else {
      record = { modified: obj.lastModified || Date.now() };
      updated = true;
    }

    return updated ? record : null;
  }

  // #endregion Private Methods (11)
}
