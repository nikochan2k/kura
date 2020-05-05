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
import { DIR_SEPARATOR, INDEX_FILE_PATH } from "./FileSystemConstants";
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
  private dirPathIndexUpdated: boolean;

  abstract readonly filesystem: FileSystem;
  abstract readonly name: string;

  constructor(public readonly options: FileSystemOptions) {
    this.initialize(options);
  }

  async delete(fullPath: string, isFile: boolean) {
    if (fullPath === DIR_SEPARATOR) {
      throw new InvalidModificationError(this.name, fullPath);
    }

    try {
      await this.doGetObject(fullPath); // Check existance.
      if (this.options.index) {
        const record = await this.getRecord(fullPath);
        await this.checkDeletePermission(fullPath, record);
        this.debug("delete", fullPath);
        if (this.options.indexOptions.logicalDelete) {
          await this.doDelete(fullPath, isFile);
        }
        await this.removeFromIndex(fullPath);
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
    if (this.options.index) {
      await this.checkGetPermission(fullPath);
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
      try {
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
          await this.putDirPathIndex(dirPathIndex);
        }
        throw e;
      }
      fileNameIndex = {};
      for (const obj of objects) {
        if (obj.fullPath == INDEX_FILE_PATH) {
          continue;
        }
        const record: Record = { obj: obj, updated: Date.now() };
        try {
          await this.checkAddPermission(obj.fullPath, record);
        } catch (e) {
          if (e instanceof NoModificationAllowedError) {
            console.debug(e, record.obj);
          } else {
            console.warn(e, record.obj);
          }
          continue;
        }
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
      const record = await this.checkGetPermission(fullPath);
      return record.obj;
    }
    try {
      this.debug("getObject", fullPath);
      const obj = await this.doGetObject(fullPath);
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

  async putContent(
    fullPath: string,
    content: Blob | Uint8Array | ArrayBuffer | string
  ): Promise<void> {
    try {
      this.debug("putContent", fullPath);
      await this.doPutContent(fullPath, content);

      const obj = await this.doGetObject(fullPath);
      if (this.options.index) {
        await this.updateIndex(obj);
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

  async putDirPathIndex(dirPathIndex: DirPathIndex) {
    if (this.options.indexOptions.writeDelayMillis <= 0) {
      await this.doPutDirPathIndex(dirPathIndex);
    } else {
      this.dirPathIndexUpdated = true;
    }
  }

  async putFileNameIndex(dirPath: string, fileNameIndex: FileNameIndex) {
    const dirPathIndex = await this.getDirPathIndex();
    dirPathIndex[dirPath] = fileNameIndex;
    await this.putDirPathIndex(dirPathIndex);
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
      await this.updateIndex(obj);
    }
  }

  async putText(fullPath: string, text: string): Promise<void> {
    const buffer = textToArrayBuffer(text);
    await this.putContent(fullPath, buffer);
  }

  toURL(path: string): string {
    throw new NotImplementedError(this.filesystem.name, path);
  }

  async updateIndex(obj: FileSystemObject) {
    const dirPath = getParentPath(obj.fullPath);
    const fileNameIndex = await this.getFileNameIndex(dirPath);
    let record = fileNameIndex[obj.name];
    if (!record) {
      record = { obj: obj, updated: Date.now() };
      await this.checkAddPermission(obj.fullPath, record);
      fileNameIndex[obj.name] = record;
    } else {
      record.obj = obj;
      record.updated = Date.now();
      await this.checkUpdatePermission(obj.fullPath, record);
      delete record.deleted;
    }
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
      console.log(`${this.name} - ${title}: fullPath=${value}`);
    } else {
      console.log(
        `${this.name} - ${title}: fullPath=${value.fullPath}, lastModified=${value.lastModified}, size=${value.size}`
      );
    }
  }

  protected async doPutDirPathIndex(dirPathIndex: DirPathIndex) {
    const text = objectToText(dirPathIndex);
    const buffer = textToArrayBuffer(text);
    await this.doPutContent(INDEX_FILE_PATH, buffer);
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
      try {
        await this.checkGetPermission(record.obj.fullPath, record);
      } catch (e) {
        if (!(e instanceof NotFoundError)) {
          console.warn(e, record.obj);
        }
        continue;
      }
      if (record.deleted != null) {
        continue;
      }
      objects.push(record.obj);
    }
    return objects;
  }

  protected async getObjectsFromStorage(dirPath: string) {
    this.debug("getObjectsFromStorage", dirPath);
    const objects = await this.doGetObjects(dirPath);
    return objects.filter((obj) => obj.fullPath !== INDEX_FILE_PATH);
  }

  protected initialize(options: FileSystemOptions) {
    this.initializeIndexOptions(options);
    this.initializeContentCacheOptions(options);
    if (options.contentsCache) {
      this.contentsCache = new ContentsCache(this);
    }
  }

  protected initializeContentCacheOptions(options: FileSystemOptions) {
    if (options.contentsCache == null) {
      options.contentsCache = true;
    } else if (options.contentsCache === false) {
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
    if (contentsCacheOptions.private == null) {
      contentsCacheOptions.private = false;
    }
  }

  protected initializeIndexOptions(options: FileSystemOptions) {
    if (options.index == null) {
      options.index = false;
    }
    if (options.index === false) {
      return;
    }

    if (options.indexOptions == null) {
      options.indexOptions = {};
    }
    const indexOptions = options.indexOptions;
    if (indexOptions.logicalDelete == null) {
      indexOptions.logicalDelete = false;
    }
    if (
      indexOptions.writeDelayMillis == null ||
      indexOptions.writeDelayMillis <= 0
    ) {
      indexOptions.writeDelayMillis = 3000;
    }
    if (0 < indexOptions.writeDelayMillis) {
      setInterval(async () => {
        if (!this.dirPathIndexUpdated) {
          return;
        }
        try {
          const dirPathIndex = await this.getDirPathIndex();
          await this.putDirPathIndex(dirPathIndex);
          this.dirPathIndexUpdated = false;
        } catch {}
      }, indexOptions.writeDelayMillis);
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
      await this.putDirPathIndex(dirPathIndex);
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

  private async checkAddPermission(fullPath: string, record: Record) {
    if (!this.options.permission.onAdd) {
      return;
    }
    if (!this.options.permission.onAdd(record)) {
      throw new NoModificationAllowedError(this.name, fullPath, "Cannot add");
    }
  }

  private async checkDeletePermission(fullPath: string, record: Record) {
    if (!this.options.permission.onDelete) {
      return;
    }
    if (!this.options.permission.onDelete(record)) {
      throw new NoModificationAllowedError(
        this.name,
        fullPath,
        "Cannot delete"
      );
    }
  }

  private async checkGetPermission(fullPath: string, record?: Record) {
    if (!record) {
      record = await this.getRecord(fullPath);
    }
    if (record.deleted) {
      throw new NotFoundError(this.name, fullPath);
    }

    if (!this.options.permission.onGet) {
      return record;
    }
    if (!this.options.permission.onGet(record)) {
      throw new NotFoundError(this.name, fullPath);
    }
    return record;
  }

  private async checkUpdatePermission(fullPath: string, record: Record) {
    if (!this.options.permission.onUpdate) {
      return;
    }
    if (!this.options.permission.onUpdate(record)) {
      throw new NoModificationAllowedError(
        this.name,
        fullPath,
        "Cannot update"
      );
    }
  }
}
