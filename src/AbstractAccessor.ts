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
import { getName, getParentPath } from "./FileSystemUtil";
import { objectToText, textToObject } from "./ObjectUtil";
import { textToArrayBuffer, toText } from "./TextConverter";

const ROOT_OBJECT: FileSystemObject = {
  fullPath: "/",
  name: "",
  lastModified: 0,
};

export abstract class AbstractAccessor {
  private static INDEX_NOT_FOUND: any = null;

  private fileNameIndexUpdateTimers: { [dirPath: string]: any } = {};

  protected contentsCache: ContentsCache;

  abstract readonly filesystem: FileSystem;
  abstract readonly name: string;

  dirPathIndex: DirPathIndex = {};

  constructor(public readonly options: FileSystemOptions) {
    this.initialize(options);
  }

  async clearContentsCache(fullPath: string) {
    if (this.contentsCache == null) {
      return;
    }
    this.contentsCache.remove(fullPath);
  }

  async clearFileNameIndex(dirPath: string) {
    delete this.dirPathIndex[dirPath];
  }

  createRecord(obj: FileSystemObject): Record {
    return { obj, modified: Date.now() };
  }

  async delete(fullPath: string, isFile: boolean) {
    if (fullPath === DIR_SEPARATOR) {
      throw new InvalidModificationError(this.name, fullPath, "delete");
    }

    try {
      await this.doGetObject(fullPath); // Check existance.
      if (this.options.index) {
        const record = await this.getRecord(fullPath);
        await this.beforeDelete(record);
        this.debug("delete", fullPath);
        if (!this.options.indexOptions.logicalDelete) {
          await this.doDelete(fullPath, isFile);
        }
        await this.removeFromIndex(fullPath);
        this.afterDelete(record);
      } else {
        this.debug("delete", fullPath);
        await this.doDelete(fullPath, isFile);
      }
      if (isFile && this.contentsCache) {
        this.contentsCache.remove(fullPath);
      }
    } catch (e) {
      if (e instanceof NotFoundError) {
        await this.removeFromIndex(fullPath, true);
        if (isFile && this.contentsCache) {
          this.contentsCache.remove(fullPath);
        }
        return;
      } else if (e instanceof AbstractFileError) {
        throw e;
      }
      throw new InvalidModificationError(this.name, fullPath, e);
    }
  }

  async deleteRecursively(fullPath: string) {
    const objects = await this.getObjects(fullPath);
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

  async doLoadFileNameIndex(dirPath: string) {
    const indexPath = this.createIndexPath(dirPath);
    const content = await this.doReadContent(indexPath);
    const text = await toText(content);
    if (!text) {
      throw new NotFoundError(this.name, dirPath, "doLoadFileNameIndex");
    }
    return textToObject(text) as FileNameIndex;
  }

  async doWriteContent(
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

  async getFileNameIndex(dirPath: string) {
    let fileNameIndex = this.dirPathIndex[dirPath];
    if (fileNameIndex === AbstractAccessor.INDEX_NOT_FOUND) {
      throw new NotFoundError(this.name, dirPath, "getFileNameIndex");
    } else if (typeof fileNameIndex === "undefined") {
      try {
        fileNameIndex = await this.doLoadFileNameIndex(dirPath);
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
          const now = Date.now();
          fileNameIndex = {
            "": {
              obj: ROOT_OBJECT,
              modified: now,
            },
          };
        } else {
          fileNameIndex = {};
        }
        for (const obj of objects) {
          const record = this.createRecord(obj);
          fileNameIndex[obj.name] = record;
        }
        await this.doSaveFileNameIndex(dirPath, fileNameIndex);
      }
      this.dirPathIndex[dirPath] = fileNameIndex;
    }
    return fileNameIndex;
  }

  async getObject(fullPath: string) {
    if (this.options.index) {
      const record = await this.getRecord(fullPath);
      await this.beforeHead(record, true);
      this.afterHead(record);
      return record.obj;
    }

    if (fullPath === DIR_SEPARATOR) {
      return ROOT_OBJECT;
    }

    try {
      this.debug("getObject", fullPath);
      const obj = await this.doGetObject(fullPath);
      if (!this.options.index) {
        const record = this.createRecord(obj);
        await this.beforeHead(record, true); // Actually, after get.
        this.afterHead(record);
      }
      return obj;
    } catch (e) {
      if (e instanceof NotFoundError) {
        await this.removeFromIndex(fullPath, true);
        if (this.contentsCache) {
          this.contentsCache.remove(fullPath);
        }
        throw e;
      } else if (e instanceof AbstractFileError) {
        throw e;
      }
      throw new NotReadableError(this.name, fullPath, e);
    }
  }

  async getObjects(dirPath: string) {
    try {
      return this.options.index
        ? await this.getObjectsFromIndex(dirPath)
        : await this.getObjectsFromStorage(dirPath);
    } catch (e) {
      if (e instanceof AbstractFileError) {
        throw e;
      }
      throw new NotReadableError(this.name, dirPath, e);
    }
  }

  async getRecord(fullPath: string) {
    const dirPath = getParentPath(fullPath);
    const name = getName(fullPath);
    const index = await this.getFileNameIndex(dirPath);
    const record = index[name];
    if (!record || record.deleted != null) {
      throw new NotFoundError(this.name, fullPath, "getRecord");
    }
    return record;
  }

  async putObject(
    obj: FileSystemObject,
    content?: Blob | Uint8Array | ArrayBuffer | string
  ): Promise<FileSystemObject> {
    if (obj.fullPath === DIR_SEPARATOR) {
      throw new InvalidModificationError(
        this.name,
        obj.fullPath,
        `cannot write to root "${DIR_SEPARATOR}"`
      );
    }
    if (this.options.index && obj.fullPath.startsWith(INDEX_DIR)) {
      throw new InvalidModificationError(
        this.name,
        obj.fullPath,
        `cannot write to index dir "${INDEX_DIR}"`
      );
    }

    let create = false;
    let record: Record;
    if (this.options.index) {
      try {
        record = await this.getRecord(obj.fullPath);
      } catch (e) {
        if (e instanceof NotFoundError) {
          record = this.createRecord(obj);
          create = true;
        } else {
          throw e;
        }
      }
    } else {
      try {
        obj = await this.doGetObject(obj.fullPath);
        record = this.createRecord(obj);
      } catch (e) {
        if (e instanceof NotFoundError) {
          record = this.createRecord(obj);
          create = true;
        } else {
          throw e;
        }
      }
    }

    if (create) {
      await this.beforePost(record);
    } else {
      await this.beforePut(record);
    }

    try {
      if (content == null) {
        // Directory
        this.makeDirectory(obj);
        if (this.options.index) {
          await this.updateIndex(record);
        }
      } else {
        // File
        obj = await this.writeContent(obj.fullPath, content);
      }
    } catch (e) {
      if (e instanceof AbstractFileError) {
        throw e;
      }
      throw new InvalidModificationError(this.name, obj.fullPath, e);
    }

    if (create) {
      this.afterPost(record);
    } else {
      this.afterPut(record);
    }

    return obj;
  }

  async putText(
    obj: FileSystemObject,
    text: string
  ): Promise<FileSystemObject> {
    const buffer = textToArrayBuffer(text);
    return this.putObject(obj, buffer);
  }

  async readContent(
    obj: FileSystemObject,
    type?: DataType
  ): Promise<Blob | Uint8Array | ArrayBuffer | string> {
    const fullPath = obj.fullPath;
    let record: Record;
    if (this.options.index) {
      record = await this.getRecord(fullPath);
    } else {
      record = this.createRecord(obj);
    }
    await this.beforeGet(record, true);

    try {
      this.debug("readContent", fullPath);
      const content = await this.readContentInternal(obj, type);
      this.afterGet(record);
      return content;
    } catch (e) {
      if (e instanceof NotFoundError) {
        await this.removeFromIndex(fullPath, true);
        if (this.contentsCache) {
          this.contentsCache.remove(fullPath);
        }
        throw e;
      } else if (e instanceof AbstractFileError) {
        throw e;
      }
      throw new NotReadableError(this.name, fullPath, e);
    }
  }

  async readContentInternal(
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

  async readText(obj: FileSystemObject): Promise<string> {
    const content = await this.readContent(obj);
    const text = await toText(content);
    return text;
  }

  async saveFileNameIndex(dirPath: string, immediately = false) {
    const fileNameIndex = this.dirPathIndex[dirPath];
    if (immediately || this.options.indexOptions.writeDelayMillis <= 0) {
      await this.doSaveFileNameIndex(dirPath, fileNameIndex);
    } else {
      this.doSaveFileNameIndexLater(dirPath, fileNameIndex);
    }
  }

  toURL(fullPath: string): string {
    throw new NotImplementedError(this.filesystem.name, fullPath, "toURL");
  }

  async updateIndex(record: Record) {
    const obj = record.obj;
    const parentPath = getParentPath(obj.fullPath);
    const fileNameIndex = await this.getFileNameIndex(parentPath);
    record.modified = Date.now();
    fileNameIndex[obj.name] = record;
    delete record.deleted;
    this.dirPathIndex[parentPath] = fileNameIndex;
    await this.saveFileNameIndex(parentPath);
  }

  abstract doDelete(fullPath: string, isFile: boolean): Promise<void>;
  abstract doGetObject(fullPath: string): Promise<FileSystemObject>;
  abstract doGetObjects(dirPath: string): Promise<FileSystemObject[]>;
  abstract doMakeDirectory(obj: FileSystemObject): Promise<void>;
  abstract doReadContent(
    fullPath: string
  ): Promise<Blob | Uint8Array | ArrayBuffer | string>;

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

  protected async doSaveFileNameIndex(
    dirPath: string,
    fileNameIndex: FileNameIndex
  ) {
    this.clearFileNameIndexUpdateTimer(dirPath);
    if(Object.keys(fileNameIndex).length === 0){
      this.debug("No indexes !", dirPath)
      return;
    }

    const text = objectToText(fileNameIndex);
    const buffer = textToArrayBuffer(text);
    const indexPath = this.createIndexPath(dirPath);
    this.debug("doSaveFileNameIndex", indexPath);
    await this.doWriteContent(indexPath, buffer);
  }

  protected async doWriteUint8Array(
    fullPath: string,
    view: Uint8Array
  ): Promise<void> {
    const buffer = await toArrayBuffer(view);
    await this.doWriteArrayBuffer(fullPath, buffer);
  }

  protected async getObjectsFromIndex(dirPath: string) {
    this.debug("getObjectsFromIndex", dirPath);
    const fileNameIndex = await this.getFileNameIndex(dirPath);
    const objects: FileSystemObject[] = [];
    for (const record of Object.values(fileNameIndex)) {
      const obj = record.obj;
      if (!obj.name) {
        continue; // Root directory
      }
      if (obj.fullPath.startsWith(INDEX_DIR)) {
        continue;
      }
      if (record.deleted != null) {
        continue;
      }
      if (!(await this.beforeHead(record, false))) {
        continue;
      }
      this.afterHead(record);
      objects.push(obj);
    }

    return objects;
  }

  protected async getObjectsFromStorage(dirPath: string) {
    this.debug("getObjectsFromStorage", dirPath);
    const objects = await this.doGetObjects(dirPath);
    if (this.options.event.preHead) {
      for (const obj of objects) {
        const record = this.createRecord(obj);
        if (!(await this.beforeHead(record, false))) {
          continue;
        }
        this.afterHead(record);
      }
    }
    return objects.filter((obj) => !obj.fullPath.startsWith(INDEX_DIR));
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

    if (options.shared || indexOptions.writeDelayMillis < 0) {
      indexOptions.writeDelayMillis = 0;
    } else if (indexOptions.writeDelayMillis == null) {
      indexOptions.writeDelayMillis = 1000;
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
      const record = this.createRecord(obj);
      await this.updateIndex(record);
    }
    return obj;
  }

  protected async removeFromIndex(fullPath: string, purge = false) {
    if (!this.options.index) {
      return;
    }

    let removed = false;
    const dirPath = getParentPath(fullPath);
    const fileNameIndex = await this.getFileNameIndex(dirPath);
    if (fileNameIndex) {
      const name = getName(fullPath);
      if(purge) {
        delete fileNameIndex[name];
      } else {
        const record = fileNameIndex[name];
        if (record && record.deleted == null) {
          record.deleted = Date.now();
          removed = true;
        }
        }
    }

    if (removed) {
      this.dirPathIndex[dirPath] = fileNameIndex;
      await this.saveFileNameIndex(dirPath);
    }
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

  protected abstract doWriteArrayBuffer(
    fullPath: string,
    buffer: ArrayBuffer
  ): Promise<void>;
  protected abstract doWriteBase64(
    fullPath: string,
    base64: string
  ): Promise<void>;
  protected abstract doWriteBlob(fullPath: string, blob: Blob): Promise<void>;

  private afterDelete(record: Record) {
    if (!this.options.event.postDelete) {
      return;
    }
    this.options.event.postDelete(record);
  }

  private afterGet(record: Record) {
    if (!this.options.event.postGet) {
      return;
    }
    this.options.event.postHead(record);
  }

  private afterHead(record: Record) {
    if (!this.options.event.postHead) {
      return;
    }
    this.options.event.postHead(record);
  }

  private afterPost(record: Record) {
    if (!this.options.event.postPost) {
      return;
    }
    this.options.event.postPost(record);
  }

  private afterPut(record: Record) {
    if (!this.options.event.postPut) {
      return;
    }
    this.options.event.postPut(record);
  }

  private async beforeDelete(record: Record) {
    if (!this.options.event.preDelete) {
      return;
    }

    const result = await this.options.event.preDelete(record);
    if (!result) {
      throw new NoModificationAllowedError(
        this.name,
        record.obj.fullPath,
        "beforeDelete"
      );
    }
  }

  private async beforeGet(record: Record, throwError: boolean) {
    if (record.deleted) {
      if (throwError) {
        throw new NotFoundError(this.name, record.obj.fullPath, "beforeGet");
      } else {
        return false;
      }
    }

    if (!this.options.event.preGet) {
      return true;
    }

    const result = await this.options.event.preGet(record);
    if (!result) {
      if (throwError) {
        throw new NotReadableError(this.name, record.obj.fullPath, "beforeGet");
      } else {
        return false;
      }
    }

    return true;
  }

  private async beforeHead(record: Record, throwError: boolean) {
    if (record.deleted) {
      if (throwError) {
        throw new NotFoundError(this.name, record.obj.fullPath, "beforeHead");
      } else {
        return false;
      }
    }

    if (!this.options.event.preHead) {
      return true;
    }

    const result = await this.options.event.preHead(record);
    if (!result) {
      if (throwError) {
        throw new NotReadableError(
          this.name,
          record.obj.fullPath,
          "beforeHead"
        );
      } else {
        return false;
      }
    }

    return true;
  }

  private async beforePost(record: Record) {
    if (!this.options.event.prePost) {
      return;
    }

    const result = await this.options.event.prePost(record);
    if (!result) {
      throw new NoModificationAllowedError(
        this.name,
        record.obj.fullPath,
        "beforePost"
      );
    }
  }

  private async beforePut(record: Record) {
    if (!this.options.event.prePut) {
      return;
    }

    const result = await this.options.event.prePut(record);
    if (!result) {
      throw new NoModificationAllowedError(
        this.name,
        record.obj.fullPath,
        "beforePut"
      );
    }
  }

  private clearFileNameIndexUpdateTimer(dirPath: string) {
    let fileNameIndexUpdateTimer = this.fileNameIndexUpdateTimers[dirPath];
    if (fileNameIndexUpdateTimer != null) {
      delete this.fileNameIndexUpdateTimers[dirPath];
      clearTimeout(fileNameIndexUpdateTimer);
    }
  }

  private createIndexDir(dirPath: string) {
    let indexDir = INDEX_DIR + dirPath;
    if (!indexDir.endsWith(DIR_SEPARATOR)) {
      indexDir += DIR_SEPARATOR;
    }
    return indexDir;
  }

  private createIndexPath(dirPath: string) {
    const indexDir = this.createIndexDir(dirPath);
    const indexPath = indexDir + INDEX_FILE_NAME;
    return indexPath;
  }

  private doSaveFileNameIndexLater(
    dirPath: string,
    fileNameIndex: FileNameIndex
  ) {
    this.clearFileNameIndexUpdateTimer(dirPath);

    this.fileNameIndexUpdateTimers[dirPath] = setTimeout(async () => {
      const current = this.fileNameIndexUpdateTimers[dirPath];
      if (current != null) {
        delete this.fileNameIndexUpdateTimers[dirPath];
        await this.doSaveFileNameIndex(dirPath, fileNameIndex);
      }
    }, this.options.indexOptions.writeDelayMillis);
  }
}
