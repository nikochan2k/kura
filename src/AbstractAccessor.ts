import {
  AbstractFileError,
  InvalidModificationError,
  NoModificationAllowedError,
  NotFoundError,
  NotImplementedError,
  NotReadableError
} from "./FileError";
import { FileSystem } from "./filesystem";
import { DIR_SEPARATOR, INDEX_FILE_PATH } from "./FileSystemConstants";
import { DirPathIndex, FileNameIndex, Record } from "./FileSystemIndex";
import { FileSystemObject } from "./FileSystemObject";
import { FileSystemOptions } from "./FileSystemOptions";
import {
  blobToObject,
  getName,
  getParentPath,
  objectToBlob
} from "./FileSystemUtil";

const ROOT_OBJECT: FileSystemObject = {
  fullPath: "/",
  name: "",
  lastModified: 0
};

const ROOT_RECORD: Record = {
  obj: ROOT_OBJECT,
  updated: 0
};

export abstract class AbstractAccessor {
  private dirPathIndex: DirPathIndex;
  private putIndexTimeout: any;

  abstract readonly filesystem: FileSystem;
  abstract readonly name: string;

  static PUT_INDEX_THROTTLE = 3000;

  constructor(public readonly options: FileSystemOptions) {}

  _delete(fullPath: string, isFile: boolean): Promise<void> {
    this.debug("delete", fullPath);
    try {
      return this.doDelete(fullPath, isFile);
    } catch (e) {
      if (e instanceof AbstractFileError) {
        throw e;
      }
      throw new InvalidModificationError(this.name, fullPath, e);
    }
  }

  _getContent(fullPath: string): Promise<Blob> {
    this.debug("getContent", fullPath);
    try {
      return this.doGetContent(fullPath);
    } catch (e) {
      if (e instanceof AbstractFileError) {
        throw e;
      }
      throw new NotReadableError(this.name, fullPath, e);
    }
  }

  _getObject(fullPath: string): Promise<FileSystemObject> {
    this.debug("getObject", fullPath);
    try {
      return this.doGetObject(fullPath);
    } catch (e) {
      if (e instanceof AbstractFileError) {
        throw e;
      }
      throw new NotReadableError(this.name, fullPath, e);
    }
  }

  _getObjects(dirPath: string): Promise<FileSystemObject[]> {
    this.debug("getObjects", dirPath);
    try {
      return this.doGetObjects(dirPath);
    } catch (e) {
      if (e instanceof AbstractFileError) {
        throw e;
      }
      throw new NotReadableError(this.name, dirPath, e);
    }
  }

  _putContent(fullPath: string, content: Blob): Promise<void> {
    this.debug("putContent", fullPath, content);
    try {
      return this.doPutContent(fullPath, content);
    } catch (e) {
      if (e instanceof AbstractFileError) {
        throw e;
      }
      throw new InvalidModificationError(this.name, fullPath, e);
    }
  }

  _putObject(obj: FileSystemObject): Promise<void> {
    this.debug("putObject", obj);
    try {
      return this.doPutObject(obj);
    } catch (e) {
      if (e instanceof AbstractFileError) {
        throw e;
      }
      throw new InvalidModificationError(this.name, obj.fullPath, e);
    }
  }

  async delete(fullPath: string, isFile: boolean) {
    if (fullPath === DIR_SEPARATOR) {
      return;
    }
    if (this.options.useIndex) {
      const record = await this.getRecord(fullPath);
      await this.checkDeletePermission(fullPath, record);
      const dirPath = getParentPath(fullPath);
      await this.handleIndex(dirPath, async () => {
        record.deleted = Date.now();
        await this._delete(fullPath, isFile);
      });
    } else {
      await this._delete(fullPath, isFile);
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

  async getContent(fullPath: string) {
    if (fullPath === DIR_SEPARATOR) {
      return null;
    }
    if (this.options.useIndex) {
      await this.checkGetPermission(fullPath);
      await this.getRecord(fullPath);
    }
    return this._getContent(fullPath);
  }

  async getDirPathIndex() {
    if (this.dirPathIndex == null) {
      try {
        const blob = await this._getContent(INDEX_FILE_PATH);
        this.dirPathIndex = (await blobToObject(blob)) as DirPathIndex;
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
      await this.checkGetPermission(fullPath);
      const record = await this.getRecord(fullPath);
      return record.obj;
    }
    return this._getObject(fullPath);
  }

  async getObjects(dirPath: string) {
    return this.options.useIndex
      ? await this.getObjectsFromIndex(dirPath)
      : await this.getObjectsFromDatabase(dirPath);
  }

  async getRecord(fullPath: string) {
    if (fullPath === DIR_SEPARATOR) {
      return ROOT_RECORD;
    }
    const dirPath = getParentPath(fullPath);
    const name = getName(fullPath);
    const index = await this.getFileNameIndex(dirPath);
    const record = index[name];
    if (!record || record.deleted) {
      throw new NotFoundError(this.name, fullPath);
    }
    return record;
  }

  async putDirPathIndex(dirPathIndex: DirPathIndex) {
    if (!this.options.useIndex) {
      throw new Error("No index");
    }
    const blob = objectToBlob(dirPathIndex);
    await this._putContent(INDEX_FILE_PATH, blob);
  }

  async putFileNameIndex(dirPath: string, fileNameIndex: FileNameIndex) {
    if (!this.options.useIndex) {
      throw new Error("No index");
    }

    const dirPathIndex = await this.getDirPathIndex();
    dirPathIndex[dirPath] = fileNameIndex;

    if (AbstractAccessor.PUT_INDEX_THROTTLE <= 0) {
      await this.putDirPathIndex(dirPathIndex);
      return;
    }

    clearTimeout(this.putIndexTimeout);
    this.putIndexTimeout = setTimeout(async () => {
      await this.putDirPathIndex(dirPathIndex);
    }, AbstractAccessor.PUT_INDEX_THROTTLE);
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

    await this._putObject(obj);
    if (content) {
      await this._putContent(obj.fullPath, content);
    }
    if (this.options.useIndex) {
      await this.updateIndex(obj);
    }
  }

  async resetObject(fullPath: string, size?: number) {
    if (fullPath === DIR_SEPARATOR) {
      return null;
    }
    const obj = await this._getObject(fullPath);
    if (!obj) {
      return null;
    }
    if (size) {
      obj.size = size;
      await this.putObject(obj);
    }
    return obj;
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

  protected async getObjectsFromDatabase(dirPath: string) {
    const objects = await this._getObjects(dirPath);
    if (!objects) {
      return null;
    }
    const newObjects: FileSystemObject[] = [];
    for (const obj of objects) {
      if (obj.fullPath === INDEX_FILE_PATH) {
        continue;
      }
      newObjects.push(obj);
    }
    return newObjects;
  }

  protected async getObjectsFromIndex(dirPath: string) {
    return await this.handleIndex(dirPath);
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
            this.debug(e, record.obj);
            continue;
          }
          if (record.deleted == null) {
            objects.push(record.obj);
          }
        }
      }
      return objects;
    } catch (e) {
      if (e instanceof NotFoundError) {
        objects = await this._getObjects(dirPath);
        if (!objects) {
          return;
        }
        fileNameIndex = {};
        for (const obj of objects) {
          if (obj.fullPath !== INDEX_FILE_PATH) {
            const record: Record = { obj: obj, updated: Date.now() };
            try {
              await this.checkAddPermission(obj.fullPath, record);
            } catch (e) {
              this.debug(e, record.obj);
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
      throw e;
    }
  }

  protected abstract doDelete(fullPath: string, isFile: boolean): Promise<void>;
  protected abstract doGetContent(fullPath: string): Promise<Blob>;
  protected abstract doGetObject(fullPath: string): Promise<FileSystemObject>;
  protected abstract doGetObjects(dirPath: string): Promise<FileSystemObject[]>;
  protected abstract doPutContent(
    fullPath: string,
    content: Blob
  ): Promise<void>;
  protected abstract doPutObject(obj: FileSystemObject): Promise<void>;

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
    if (!this.options.useIndex) {
      return;
    }
    if (!record) {
      record = await this.getRecord(fullPath);
    }

    if (!this.options.permission.onGet) {
      return;
    }
    if (!this.options.permission.onGet(record)) {
      throw new NotFoundError(this.name, fullPath);
    }
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

  private debug(
    title: string,
    value: string | FileSystemObject,
    content?: Blob
  ) {
    if (!this.options.verbose) {
      return;
    }
    if (typeof value === "string") {
      const sizeMessage = content ? `, size=${content.size}` : "";
      console.log(`${this.name} - ${title}: fullPath=${value}${sizeMessage}`);
    } else {
      console.log(
        `${this.name} - ${title}: fullPath=${value.fullPath}, lastModified=${value.lastModified}, size=${value.size}`
      );
    }
  }
}
