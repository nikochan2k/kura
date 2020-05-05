import { toArrayBuffer, toBase64, toBlob } from "./BinaryConverter";
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
import { getName, getParentPath, getSize } from "./FileSystemUtil";
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

interface ContentCacheEntry {
  access: number;
  content: Blob | Uint8Array | ArrayBuffer | string;
  size: number;
}

export abstract class AbstractAccessor {
  private contentCache: { [fullPath: string]: ContentCacheEntry } = {};
  private dirPathIndex: DirPathIndex;
  private dirPathIndexUpdated: boolean;

  abstract readonly filesystem: FileSystem;
  abstract readonly name: string;

  constructor(public readonly options: FileSystemOptions) {
    if (options.contentCacheCapacity == null) {
      options.contentCacheCapacity = 10 * 1024 * 1024; // 10MB
    }
    if (options.indexWriteDelayMillis == null) {
      options.indexWriteDelayMillis = 3000;
    }
    if (0 < options.indexWriteDelayMillis) {
      setInterval(async () => {
        if (!this.dirPathIndexUpdated) {
          return;
        }
        try {
          const dirPathIndex = await this.getDirPathIndex();
          await this.putDirPathIndex(dirPathIndex);
          this.dirPathIndexUpdated = false;
        } catch {}
      }, options.indexWriteDelayMillis);
    }
  }

  async delete(fullPath: string, isFile: boolean) {
    if (fullPath === DIR_SEPARATOR) {
      throw new InvalidModificationError(this.name, fullPath);
    }

    try {
      await this.doGetObject(fullPath); // Check existance.
      if (this.options.useIndex) {
        const record = await this.getRecord(fullPath);
        await this.checkDeletePermission(fullPath, record);
        const dirPath = getParentPath(fullPath);
        await this.handleIndex(dirPath, async () => {
          this.debug("delete", fullPath);
          if (this.options.logicalDelete) {
            await this.doDelete(fullPath, isFile);
          }
          if (record.deleted == null) {
            record.deleted = Date.now();
          }
        });
      } else {
        this.debug("delete", fullPath);
        await this.doDelete(fullPath, isFile);
      }
      if (isFile) {
        delete this.contentCache[fullPath];
      }
    } catch (e) {
      if (e instanceof NotFoundError) {
        await this.removeFromIndex(fullPath);
        if (isFile) {
          delete this.contentCache[fullPath];
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
    this.putContentToCache(fullPath, content);
  }

  async getContent(
    fullPath: string,
    type?: DataType
  ): Promise<Blob | Uint8Array | ArrayBuffer | string> {
    if (this.options.useIndex) {
      await this.checkGetPermission(fullPath);
    }

    try {
      this.debug("getContent", fullPath);
      let content = this.getContentFromCache(fullPath);
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
      this.putContentToCache(fullPath, content);
      return content;
    } catch (e) {
      if (e instanceof NotFoundError) {
        delete this.contentCache[fullPath];
        await this.removeFromIndex(fullPath);
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
    const index = dirPathIndex[dirPath];
    if (!index) {
      throw new NotFoundError(this.name, dirPath);
    }
    return index;
  }

  async getObject(fullPath: string) {
    if (fullPath === DIR_SEPARATOR) {
      return ROOT_OBJECT;
    }
    if (this.options.useIndex) {
      const record = await this.checkGetPermission(fullPath);
      return record.obj;
    }
    try {
      this.debug("getObject", fullPath);
      const obj = await this.doGetObject(fullPath);
      return obj;
    } catch (e) {
      if (e instanceof NotFoundError) {
        delete this.contentCache[fullPath];
        throw e;
      } else if (e instanceof AbstractFileError) {
        throw e;
      }
      throw new NotReadableError(this.name, fullPath, e);
    }
  }

  async getObjects(dirPath: string) {
    try {
      return this.options.useIndex
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

  async getText(fullPath: string): Promise<string> {
    const content = await this.getContent(fullPath);
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
    } catch (e) {
      if (e instanceof AbstractFileError) {
        throw e;
      }
      throw new InvalidModificationError(this.name, fullPath, e);
    }
  }

  async putDirPathIndex(dirPathIndex: DirPathIndex) {
    const text = objectToText(dirPathIndex);
    const buffer = textToArrayBuffer(text);
    await this.doPutContent(INDEX_FILE_PATH, buffer);
  }

  async putFileNameIndex(dirPath: string, fileNameIndex: FileNameIndex) {
    const dirPathIndex = await this.getDirPathIndex();
    dirPathIndex[dirPath] = fileNameIndex;

    if (this.options.indexWriteDelayMillis <= 0) {
      await this.putDirPathIndex(dirPathIndex);
      return;
    }

    this.dirPathIndexUpdated = true;
  }

  async putObject(obj: FileSystemObject, content?: Blob) {
    if (obj.fullPath === DIR_SEPARATOR) {
      throw new InvalidModificationError(
        this.name,
        obj.fullPath,
        `cannot write to root "${DIR_SEPARATOR}"`
      );
    }
    if (this.options.useIndex && obj.fullPath === INDEX_FILE_PATH) {
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

    if (this.options.useIndex) {
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
    await this.handleIndex(dirPath, async (fileNameIndex: FileNameIndex) => {
      let record = fileNameIndex[obj.name];
      if (!record) {
        record = { obj: obj, updated: Date.now() };
        await this.checkAddPermission(obj.fullPath, record);
        fileNameIndex[obj.name] = record;
      } else {
        record.obj = obj;
        record.updated = Date.now();
        await this.checkUpdatePermission(obj.fullPath, record);
      }
      delete record.deleted;
    });
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

  protected async doPutUint8Array(
    fullPath: string,
    view: Uint8Array
  ): Promise<void> {
    const buffer = await toArrayBuffer(view);
    await this.doPutArrayBuffer(fullPath, buffer);
  }

  protected async getObjectsFromIndex(dirPath: string) {
    this.debug("getObjectsFromIndex", dirPath);
    const objects = await this.handleIndex(dirPath);
    return objects;
  }

  protected async getObjectsFromStorage(dirPath: string) {
    this.debug("getObjectsFromStorage", dirPath);
    const objects = await this.doGetObjects(dirPath);
    const newObjects: FileSystemObject[] = [];
    for (const obj of objects) {
      if (obj.fullPath === INDEX_FILE_PATH) {
        continue;
      }
      newObjects.push(obj);
    }
    return newObjects;
  }

  protected async handleIndex(
    dirPath: string,
    update?: (fileNameIndex: FileNameIndex) => Promise<void>
  ) {
    let objects: FileSystemObject[];
    let fileNameIndex: FileNameIndex;
    try {
      fileNameIndex = await this.getFileNameIndex(dirPath);
      if (update) {
        await update(fileNameIndex);
        await this.putFileNameIndex(dirPath, fileNameIndex);
      } else {
        objects = [];
        for (const record of Object.values(fileNameIndex)) {
          try {
            await this.checkGetPermission(record.obj.fullPath, record);
          } catch (e) {
            if (e instanceof NotFoundError) {
              console.debug(e, record.obj);
            } else {
              console.warn(e, record.obj);
            }
            continue;
          }
          if (record.deleted == null) {
            objects.push(record.obj);
          }
        }
      }
      return objects;
    } catch (eIndex) {
      if (eIndex instanceof NotFoundError) {
        try {
          objects = await this.doGetObjects(dirPath);
        } catch (e) {
          if (e instanceof NotFoundError) {
            await this.deleteRecursively(dirPath);
          }
          throw e;
        }

        fileNameIndex = {};
        for (const obj of objects) {
          if (obj.fullPath !== INDEX_FILE_PATH) {
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
        }
        if (update) {
          await update(fileNameIndex);
        }
        await this.putFileNameIndex(dirPath, fileNameIndex);
        return objects;
      }
      throw eIndex;
    }
  }

  protected async removeFromIndex(fullPath: string) {
    if (!this.options.useIndex) {
      return;
    }

    const dirPath = getParentPath(fullPath);
    const name = getName(fullPath);
    try {
      const index = await this.getFileNameIndex(dirPath);
      const record = index[name];
      if (record && record.deleted == null) {
        record.deleted = Date.now();
        await this.putFileNameIndex(dirPath, index);
      }
    } catch (err) {
      if (err instanceof NotFoundError) {
        return;
      }
      console.warn(err);
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

  private getContentFromCache(fullPath: string) {
    if (this.options.contentCacheCapacity <= 0) {
      // No cache.
      return null;
    }

    const entry = this.contentCache[fullPath];
    if (!entry) {
      return null;
    }
    entry.access = Date.now();
    return entry.content;
  }

  private putContentToCache(
    fullPath: string,
    content: Blob | Uint8Array | ArrayBuffer | string
  ) {
    if (this.options.contentCacheCapacity <= 0) {
      // No cache.
      return;
    }

    const size = getSize(content);
    if (this.options.contentCacheCapacity < size) {
      return;
    }

    let sum = 0;
    const list: { fullPath: string; size: number; access: number }[] = [];
    for (const [fullPath, entry] of Object.entries(this.contentCache)) {
      sum += entry.size;
      list.push({ fullPath, size: entry.size, access: entry.access });
    }

    let current = sum + size;
    if (current <= this.options.contentCacheCapacity) {
      this.contentCache[fullPath] = {
        content,
        access: Date.now(),
        size,
      };
      return;
    }
    list.sort((a, b) => {
      return a.access < b.access ? -1 : 1;
    });

    const limit = this.options.contentCacheCapacity - size;
    for (const item of list) {
      delete this.contentCache[item.fullPath];
      current -= item.size;
      if (current <= limit) {
        break;
      }
    }

    this.contentCache[fullPath] = { content, access: Date.now(), size };
  }
}
