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

export abstract class AbstractAccessor {
  private static INDEX_NOT_FOUND: any = null;

  private dirPathIndex: DirPathIndex = {
    "": {
      "": {
        obj: ROOT_OBJECT,
        accessed: Date.now(),
        modified: Date.now(),
      },
    },
  };
  private dirPathIndexUpdateTimer: any;

  protected contentsCache: ContentsCache;

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
    const now = Date.now();
    return { obj, accessed: now, created: now, modified: now };
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

  async getDirPathIndex() {
    if (this.dirPathIndex == null) {
      await this.loadDirPathIndex();
    }
    return this.dirPathIndex;
  }

  async getFileNameIndex(dirPath: string) {
    if (dirPath === DIR_SEPARATOR) {
      dirPath = "";
    }
    const dirPathIndex = await this.getDirPathIndex();
    let fileNameIndex = dirPathIndex[dirPath];
    if (fileNameIndex === AbstractAccessor.INDEX_NOT_FOUND) {
      throw new NotFoundError(this.name, dirPath, "getFileNameIndex");
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
    const dirPath = getParentPath(fullPath);
    const name = getName(fullPath);
    const index = await this.getFileNameIndex(dirPath);
    const record = index[name];
    if (!record || record.deleted != null) {
      throw new NotFoundError(this.name, fullPath, "getRecord");
    }
    return record;
  }

  async loadDirPathIndex() {
    try {
      const content = await this.doReadContent(INDEX_FILE_PATH);
      const text = await toText(content);
      this.dirPathIndex = textToObject(text) as DirPathIndex;
    } catch (e) {
      if (!(e instanceof NotFoundError)) {
        throw e;
      }
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
    if (this.options.index && obj.fullPath === INDEX_FILE_PATH) {
      throw new InvalidModificationError(
        this.name,
        obj.fullPath,
        `cannot write to index file "${INDEX_FILE_PATH}"`
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
          await this.updateIndex(record, true);
        }
      } else {
        // File
        await this.writeContent(obj.fullPath, content);
        obj = await this.refreshObject(obj.fullPath, content);
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
      await this.beforeGet(record, true);
    } else {
      record = this.createRecord(obj);
      await this.beforeGet(record, true);
    }

    try {
      this.debug("readContent", fullPath);
      if (this.contentsCache) {
        var content = await this.contentsCache.get(fullPath);
      }
      if (!content) {
        content = await this.doReadContent(fullPath);
      }
      if (type === "blob") {
        content = toBlob(content);
      } else if (type === "arraybuffer") {
        content = await toArrayBuffer(content);
      } else if (type === "base64") {
        content = await toBase64(content);
      }
      if (this.options.index) {
        await this.updateIndex(record, false);
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

  async readText(obj: FileSystemObject): Promise<string> {
    const content = await this.readContent(obj);
    const text = await toText(content);
    return text;
  }

  async saveDirPathIndex() {
    if (this.dirPathIndexUpdateTimer != null) {
      clearTimeout(this.dirPathIndexUpdateTimer);
    }
    this.dirPathIndexUpdateTimer = null;
    const dirPathIndex = await this.getDirPathIndex();
    const text = objectToText(dirPathIndex);
    const buffer = textToArrayBuffer(text);
    await this.doWriteContent(INDEX_FILE_PATH, buffer);
  }

  toURL(fullPath: string): string {
    throw new NotImplementedError(
      this.filesystem.name,
      fullPath,
      "saveDirPathIndex"
    );
  }

  async updateIndex(record: Record, modified: boolean) {
    const obj = record.obj;
    const dirPath =
      obj.fullPath === DIR_SEPARATOR ? "" : getParentPath(obj.fullPath);
    const fileNameIndex = await this.getFileNameIndex(dirPath);
    if (modified) {
      record.modified = Date.now();
    } else {
      record.accessed = Date.now();
    }
    fileNameIndex[obj.name] = record;
    delete record.deleted;
    // await this.putFileNameIndex(dirPath, fileNameIndex);
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
      if (obj.fullPath === INDEX_FILE_PATH) {
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

    const record = await this.getRecord(dirPath);
    await this.updateIndex(record, false);

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
      await this.updateIndex(record, true);
    }
    if (this.contentsCache) {
      this.contentsCache.put(obj, content);
    }
    return obj;
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
    const fileNameIndex = await this.getFileNameIndex(dirPath);
    if (fileNameIndex) {
      const name = getName(fullPath);
      const record = fileNameIndex[name];
      if (record && record.deleted == null) {
        record.deleted = Date.now();
        removed = true;
      }
    }

    if (removed) {
      await this.putDirPathIndex();
    }
  }

  protected async writeContent(
    fullPath: string,
    content: Blob | Uint8Array | ArrayBuffer | string
  ): Promise<void> {
    try {
      this.debug("writeContent", fullPath);
      await this.doWriteContent(fullPath, content);
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
    if (!this.options.event.preDelete(record)) {
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

    if (!this.options.event.preGet(record)) {
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

    if (!this.options.event.preHead(record)) {
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
    if (!this.options.event.prePost(record)) {
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
    if (!this.options.event.prePut(record)) {
      throw new NoModificationAllowedError(
        this.name,
        record.obj.fullPath,
        "beforePut"
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
