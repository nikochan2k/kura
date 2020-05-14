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
  INDEX_FILE_NAME,
  INDEX_FILE_PATH,
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

const ROOT_RECORD: Record = {
  obj: ROOT_OBJECT,
  updated: 0,
};

export abstract class AbstractAccessor {
  private static INDEX_NOT_FOUND: any = null;

  private contentsCache: ContentsCache;
  private dirPathIndex: DirPathIndex;
  private dirPathIndexUpdateTimer: any;

  abstract readonly filesystem: FileSystem;
  abstract readonly name: string;

  constructor(public readonly options: FileSystemOptions) {
    this.initialize(options);
  }

  async clearContentsCache(startsWith?: string) {
    if (this.contentsCache == null) {
      return;
    }
    this.contentsCache.removeBy(startsWith);
  }

  createRecord(obj: FileSystemObject): Record {
    return { obj, updated: Date.now() };
  }

  async delete(fullPath: string, isFile: boolean) {
    if (fullPath === DIR_SEPARATOR) {
      throw new InvalidModificationError(this.name, fullPath);
    }

    try {
      await this.doGetObject(fullPath); // Check existance.
      if (this.options.index) {
        const record = await this.getRecord(fullPath);
        await this.beforeDelete(record);
        this.debug("delete", fullPath);
        if (this.options.indexOptions.logicalDelete) {
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
        await this.removeFromIndex(fullPath);
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

  async doPutContent(
    fullPath: string,
    content: Blob | Uint8Array | ArrayBuffer | string
  ) {
    if (content instanceof Blob) {
      await this.doPutBlob(fullPath, content);
    } else if (content instanceof ArrayBuffer) {
      await this.doPutArrayBuffer(fullPath, content);
    } else if (content instanceof Uint8Array) {
      await this.doPutUint8Array(fullPath, content);
    } else {
      await this.doPutBase64(fullPath, content);
    }
  }

  async getContent(
    obj: FileSystemObject,
    type?: DataType
  ): Promise<Blob | Uint8Array | ArrayBuffer | string> {
    const fullPath = obj.fullPath;
    let record: Record;
    if (this.options.index) {
      record = await this.getRecord(fullPath);
      await this.beforeGet(record, true);
    } else {
      record = this.createRecord(obj);
      await this.beforeGet(record, true);
    }

    try {
      this.debug("getContent", fullPath);
      if (this.contentsCache) {
        var content = await this.contentsCache.get(fullPath);
      }
      if (!content) {
        content = await this.doGetContent(fullPath);
      }
      if (type === "blob") {
        content = toBlob(content);
      } else if (type === "arraybuffer") {
        content = await toArrayBuffer(content);
      } else if (type === "base64") {
        content = await toBase64(content);
      }
      if (this.contentsCache) {
        this.contentsCache.put(obj, content);
      }
      this.afterGet(record);
      return content;
    } catch (e) {
      if (e instanceof NotFoundError) {
        await this.removeFromIndex(fullPath);
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

  async getDirPathIndex() {
    if (this.dirPathIndex == null) {
      await this.loadDirPathIndex();
    }
    return this.dirPathIndex;
  }

  async getFileNameIndex(dirPath: string) {
    const dirPathIndex = await this.getDirPathIndex();
    let fileNameIndex = dirPathIndex[dirPath];
    if (fileNameIndex === AbstractAccessor.INDEX_NOT_FOUND) {
      throw new NotFoundError(this.name, dirPath);
    } else if (typeof fileNameIndex === "undefined") {
      try {
        var objects = await this.doGetObjects(dirPath);
      } catch (e) {
        if (e instanceof NotFoundError) {
          dirPathIndex[dirPath] = AbstractAccessor.INDEX_NOT_FOUND;
          await this.putDirPathIndex();
        }
        throw e;
      }
      fileNameIndex = {};
      for (const obj of objects) {
        if (obj.fullPath == INDEX_FILE_PATH) {
          continue;
        }
        const record = this.createRecord(obj);
        fileNameIndex[obj.name] = record;
      }
      await this.putFileNameIndex(dirPath, fileNameIndex);
    }
    return fileNameIndex;
  }

  async getObject(fullPath: string) {
    if (fullPath === DIR_SEPARATOR) {
      return ROOT_OBJECT;
    }

    if (this.options.index) {
      const record = await this.getRecord(fullPath);
      await this.beforeGet(record, true);
      return record.obj;
    }

    try {
      this.debug("getObject", fullPath);
      const obj = await this.doGetObject(fullPath);
      if (!this.options.index) {
        const record = this.createRecord(obj);
        await this.beforeGet(record, true); // Actually, after get.
      }

      return obj;
    } catch (e) {
      if (e instanceof NotFoundError) {
        await this.removeFromIndex(fullPath);
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
    if (fullPath === DIR_SEPARATOR) {
      return ROOT_RECORD;
    }
    const dirPath = getParentPath(fullPath);
    const name = getName(fullPath);
    const index = await this.getFileNameIndex(dirPath);
    const record = index[name];
    if (!record || record.deleted != null) {
      throw new NotFoundError(this.name, fullPath);
    }
    return record;
  }

  async getText(obj: FileSystemObject): Promise<string> {
    const content = await this.getContent(obj);
    const text = await toText(content);
    return text;
  }

  async loadDirPathIndex() {
    try {
      await this.doGetObject(INDEX_FILE_PATH);
      const content = await this.doGetContent(INDEX_FILE_PATH);
      const text = await toText(content);
      this.dirPathIndex = textToObject(text) as DirPathIndex;
    } catch (e) {
      if (e instanceof NotFoundError) {
        this.dirPathIndex = {};
      } else {
        throw e;
      }
    }
  }

  async putContent(
    fullPath: string,
    content: Blob | Uint8Array | ArrayBuffer | string
  ): Promise<void> {
    try {
      this.debug("putContent", fullPath);
      await this.doPutContent(fullPath, content);

      const obj = await this.doGetObject(fullPath);
      if (this.options.index) {
        let record: Record;
        try {
          record = await this.getRecord(obj.fullPath);
        } catch (e) {
          if (e instanceof NotFoundError) {
            record = this.createRecord(obj);
          } else {
            throw e;
          }
        }
        await this.updateIndex(record);
      }
      if (this.contentsCache) {
        this.contentsCache.put(obj, content);
      }
    } catch (e) {
      if (e instanceof AbstractFileError) {
        throw e;
      }
      throw new InvalidModificationError(this.name, fullPath, e);
    }
  }

  async putDirPathIndex() {
    if (0 < this.options.indexOptions.writeDelayMillis) {
      this.saveDirPathIndexLater();
    } else {
      await this.saveDirPathIndex();
    }
  }

  async putFileNameIndex(dirPath: string, fileNameIndex: FileNameIndex) {
    const dirPathIndex = await this.getDirPathIndex();
    dirPathIndex[dirPath] = fileNameIndex;
    await this.putDirPathIndex();
  }

  async putObject(obj: FileSystemObject, content?: Blob) {
    if (obj.fullPath === DIR_SEPARATOR) {
      throw new InvalidModificationError(
        this.name,
        obj.fullPath,
        `cannot write to root "${DIR_SEPARATOR}"`
      );
    }
    if (this.options.index && obj.fullPath === INDEX_FILE_PATH) {
      throw new InvalidModificationError(
        this.name,
        obj.fullPath,
        `cannot write to index file "${INDEX_FILE_PATH}"`
      );
    }

    let add = false;
    let record: Record;
    if (this.options.index) {
      try {
        record = await this.getRecord(obj.fullPath);
      } catch (e) {
        if (e instanceof NotFoundError) {
          record = this.createRecord(obj);
          add = true;
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
          add = true;
        } else {
          throw e;
        }
      }
    }

    if (add) {
      await this.beforeAdd(record);
    } else {
      await this.beforeUpdate(record);
    }

    try {
      this.debug("putObject", obj);
      await this.doPutObject(obj);
    } catch (e) {
      if (e instanceof AbstractFileError) {
        throw e;
      }
      throw new InvalidModificationError(this.name, obj.fullPath, e);
    }

    if (content) {
      await this.putContent(obj.fullPath, content);
    }

    if (this.options.index) {
      await this.updateIndex(record);
    }

    if (add) {
      this.afterAdd(record);
    } else {
      this.afterUpdate(record);
    }
  }

  async putText(fullPath: string, text: string): Promise<void> {
    const buffer = textToArrayBuffer(text);
    await this.putContent(fullPath, buffer);
  }

  async saveDirPathIndex() {
    if (this.dirPathIndexUpdateTimer != null) {
      clearTimeout(this.dirPathIndexUpdateTimer);
    }
    this.dirPathIndexUpdateTimer = null;
    const dirPathIndex = await this.getDirPathIndex();
    const text = objectToText(dirPathIndex);
    const buffer = textToArrayBuffer(text);
    let obj: FileSystemObject = {
      fullPath: INDEX_FILE_PATH,
      name: INDEX_FILE_NAME,
      size: buffer.byteLength,
      lastModified: Date.now(),
    };
    await this.doPutObject(obj);
    await this.doPutContent(INDEX_FILE_PATH, buffer);
    obj = await this.doGetObject(INDEX_FILE_PATH);
  }

  toURL(fullPath: string): string {
    throw new NotImplementedError(this.filesystem.name, fullPath);
  }

  async updateIndex(record: Record) {
    const obj = record.obj;
    const dirPath = getParentPath(obj.fullPath);
    const fileNameIndex = await this.getFileNameIndex(dirPath);
    record.updated = Date.now();
    fileNameIndex[obj.name] = record;
    delete record.deleted;
    await this.putFileNameIndex(dirPath, fileNameIndex);
  }

  abstract doDelete(fullPath: string, isFile: boolean): Promise<void>;
  abstract doGetContent(
    fullPath: string
  ): Promise<Blob | Uint8Array | ArrayBuffer | string>;
  abstract doGetObject(fullPath: string): Promise<FileSystemObject>;
  abstract doGetObjects(dirPath: string): Promise<FileSystemObject[]>;
  abstract doPutObject(obj: FileSystemObject): Promise<void>;

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

  protected async doPutUint8Array(
    fullPath: string,
    view: Uint8Array
  ): Promise<void> {
    const buffer = await toArrayBuffer(view);
    await this.doPutArrayBuffer(fullPath, buffer);
  }

  protected async getObjectsFromIndex(dirPath: string) {
    this.debug("getObjectsFromIndex", dirPath);
    const fileNameIndex = await this.getFileNameIndex(dirPath);
    const objects: FileSystemObject[] = [];
    for (const record of Object.values(fileNameIndex)) {
      const obj = record.obj;
      if (obj.fullPath === INDEX_FILE_PATH) {
        continue;
      }
      if (record.deleted != null) {
        continue;
      }
      if (!(await this.beforeGet(record, false))) {
        continue;
      }
      objects.push(obj);
    }
    return objects;
  }

  protected async getObjectsFromStorage(dirPath: string) {
    this.debug("getObjectsFromStorage", dirPath);
    const objects = await this.doGetObjects(dirPath);
    if (this.options.event.preGet) {
      for (const obj of objects) {
        const record = this.createRecord(obj);
        if (!(await this.beforeGet(record, false))) {
          continue;
        }
      }
    }
    return objects.filter((obj) => obj.fullPath !== INDEX_FILE_PATH);
  }

  protected initialize(options: FileSystemOptions) {
    this.initializeIndexOptions(options);

    if (options.contentsCache == null) {
      options.contentsCache = true;
    }
    this.initializeContentCacheOptions(options);

    console.info(options);
  }

  protected initializeContentCacheOptions(options: FileSystemOptions) {
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
      contentsCacheOptions.limitSize = 128 * 1024; // 128KB;
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
      indexOptions.writeDelayMillis = 5000;
    }
  }

  protected async removeFromIndex(fullPath: string) {
    if (!this.options.index) {
      return;
    }

    let removed = false;

    // Is fullPath directory ?
    const dirPathIndex = await this.getDirPathIndex();
    for (const [path, fileNameIndex] of Object.entries(dirPathIndex)) {
      if (path === fullPath || path.startsWith(fullPath + DIR_SEPARATOR)) {
        for (const record of Object.values(fileNameIndex)) {
          if (record.deleted == null) {
            record.deleted = Date.now();
            removed = true;
          }
        }
      }
    }

    const dirPath = getParentPath(fullPath);
    const index = dirPathIndex[dirPath];
    if (index) {
      const name = getName(fullPath);
      const record = index[name];
      if (record && record.deleted == null) {
        record.deleted = Date.now();
        removed = true;
      }
    }

    if (removed) {
      await this.putDirPathIndex();
    }
  }

  protected abstract doPutArrayBuffer(
    fullPath: string,
    buffer: ArrayBuffer
  ): Promise<void>;
  protected abstract doPutBase64(
    fullPath: string,
    base64: string
  ): Promise<void>;
  protected abstract doPutBlob(fullPath: string, blob: Blob): Promise<void>;

  private afterAdd(record: Record) {
    if (!this.options.event.postAdd) {
      return;
    }
    this.options.event.postAdd(record);
  }

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
    this.options.event.postGet(record);
  }

  private afterUpdate(record: Record) {
    if (!this.options.event.postUpdate) {
      return;
    }
    this.options.event.postUpdate(record);
  }

  private async beforeAdd(record: Record) {
    if (!this.options.event.preAdd) {
      return;
    }
    if (!this.options.event.preAdd(record)) {
      throw new NoModificationAllowedError(
        this.name,
        record.obj.fullPath,
        "Cannot add"
      );
    }
  }

  private async beforeDelete(record: Record) {
    if (!this.options.event.preDelete) {
      return;
    }
    if (!this.options.event.preDelete(record)) {
      throw new NoModificationAllowedError(
        this.name,
        record.obj.fullPath,
        "Cannot delete"
      );
    }
  }

  private async beforeGet(record: Record, throwError: boolean) {
    if (record.deleted) {
      if (throwError) {
        throw new NotFoundError(this.name, record.obj.fullPath);
      } else {
        return false;
      }
    }

    if (!this.options.event.preGet) {
      return true;
    }

    if (!this.options.event.preGet(record)) {
      if (throwError) {
        throw new NotReadableError(
          this.name,
          record.obj.fullPath,
          "Cannot get"
        );
      } else {
        return false;
      }
    }

    return true;
  }

  private async beforeUpdate(record: Record) {
    if (!this.options.event.preUpdate) {
      return;
    }
    if (!this.options.event.preUpdate(record)) {
      throw new NoModificationAllowedError(
        this.name,
        record.obj.fullPath,
        "Cannot update"
      );
    }
  }

  private async saveDirPathIndexLater() {
    if (this.dirPathIndexUpdateTimer != null) {
      clearTimeout(this.dirPathIndexUpdateTimer);
    }

    this.dirPathIndexUpdateTimer = setTimeout(async () => {
      if (this.dirPathIndexUpdateTimer != null) {
        this.dirPathIndexUpdateTimer = null;
        await this.saveDirPathIndex();
      }
    }, this.options.indexOptions.writeDelayMillis);
  }
}
