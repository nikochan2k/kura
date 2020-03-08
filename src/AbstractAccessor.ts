import { clearTimeout, setTimeout } from "timers";
import {
  InvalidModificationError,
  NoModificationAllowedError,
  NotFoundError,
  NotImplementedError
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
  private putIndexTimeout: number | NodeJS.Timeout;

  abstract readonly filesystem: FileSystem;
  abstract readonly name: string;

  static PUT_INDEX_THROTTLE = 3000;

  constructor(public readonly options: FileSystemOptions) {}

  _delete(fullPath: string, isFile: boolean): Promise<void> {
    this.debug("delete", fullPath);
    return this.doDelete(fullPath, isFile);
  }

  _getContent(fullPath: string): Promise<Blob> {
    this.debug("getContent", fullPath);
    return this.doGetContent(fullPath);
  }

  _getObject(fullPath: string): Promise<FileSystemObject> {
    this.debug("getObject", fullPath);
    return this.doGetObject(fullPath);
  }

  _getObjects(dirPath: string): Promise<FileSystemObject[]> {
    this.debug("getObjects", dirPath);
    return this.doGetObjects(dirPath);
  }

  _putContent(fullPath: string, content: Blob): Promise<void> {
    this.debug("putContent", fullPath, content);
    return this.doPutContent(fullPath, content);
  }

  _putObject(obj: FileSystemObject): Promise<void> {
    this.debug("putObject", obj);
    return this.doPutObject(obj);
  }

  async delete(fullPath: string, isFile: boolean) {
    if (fullPath === DIR_SEPARATOR) {
      return;
    }
    if (this.options.useIndex) {
      const record = await this.getRecord(fullPath);
      if (!record || record.deleted) {
        return;
      }
      await this.checkDeletePermission(fullPath, record);
      const dirPath = getParentPath(fullPath);
      await this.handleIndex(dirPath, false, async () => {
        record.deleted = Date.now();
        await this._delete(fullPath, isFile);
      });
    } else {
      await this._delete(fullPath, isFile);
    }
  }

  async deleteRecursively(fullPath: string) {
    if (this.options.useIndex && fullPath !== DIR_SEPARATOR) {
      const record = await this.getRecord(fullPath);
      if (!record || record.deleted) {
        return;
      }
    }
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
    await this.checkGetPermission(fullPath);
    if (this.options.useIndex) {
      const record = await this.getRecord(fullPath);
      if (!record || record.deleted) {
        return null;
      }
    }
    return this._getContent(fullPath);
  }

  async getDirPathIndex() {
    if (!this.options.useIndex) {
      throw new Error("No index");
    }
    if (this.dirPathIndex == null) {
      const blob = await this._getContent(INDEX_FILE_PATH);
      if (blob) {
        this.dirPathIndex = (await blobToObject(blob)) as DirPathIndex;
      } else {
        this.dirPathIndex = {};
      }
    }
    return this.dirPathIndex;
  }

  async getFileNameIndex(dirPath: string) {
    if (!this.options.useIndex) {
      throw new Error("No index");
    }
    const dirPathIndex = await this.getDirPathIndex();
    return dirPathIndex[dirPath];
  }

  async getObject(fullPath: string) {
    if (fullPath === DIR_SEPARATOR) {
      return ROOT_OBJECT;
    }
    await this.checkGetPermission(fullPath);
    if (this.options.useIndex) {
      const record = await this.getRecord(fullPath);
      if (!record || record.deleted) {
        return null;
      }
    }
    return this._getObject(fullPath);
  }

  async getObjects(dirPath: string) {
    return this.options.useIndex
      ? await this.getObjectsFromIndex(dirPath)
      : await this.getObjectsFromDatabase(dirPath);
  }

  async getRecord(fullPath: string) {
    if (!this.options.useIndex) {
      throw new Error("No index");
    }
    if (fullPath === DIR_SEPARATOR) {
      return ROOT_RECORD;
    }
    const dirPath = getParentPath(fullPath);
    const name = getName(fullPath);
    const fileNameIndex = await this.getFileNameIndex(dirPath);
    if (!fileNameIndex) {
      return null;
    }
    return fileNameIndex[name];
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

    if (this.putIndexTimeout) {
      if (window) {
        window.clearTimeout(this.putIndexTimeout as number);
      } else {
        clearTimeout(this.putIndexTimeout as NodeJS.Timeout);
      }
    }
    if (window) {
      this.putIndexTimeout = window.setTimeout(async () => {
        await this.putDirPathIndex(dirPathIndex);
      }, AbstractAccessor.PUT_INDEX_THROTTLE);
    } else {
      this.putIndexTimeout = setTimeout(async () => {
        await this.putDirPathIndex(dirPathIndex);
      }, AbstractAccessor.PUT_INDEX_THROTTLE);
    }
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
    if (!this.options.useIndex) {
      throw new Error("No index");
    }
    const dirPath = getParentPath(obj.fullPath);
    await this.handleIndex(
      dirPath,
      false,
      async (fileNameIndex: FileNameIndex) => {
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
      }
    );
  }

  protected async getObjectsFromDatabase(dirPath: string) {
    const objects = await this._getObjects(dirPath);
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
    if (dirPath !== DIR_SEPARATOR) {
      const record = await this.getRecord(dirPath);
      if (!record || record.deleted) {
        return [];
      }
    }
    return await this.handleIndex(dirPath, true);
  }

  protected async handleIndex(
    dirPath: string,
    needObjects: boolean,
    update?: (fileNameIndex: FileNameIndex) => Promise<void>
  ) {
    let fileNameIndex = await this.getFileNameIndex(dirPath);
    let objects: FileSystemObject[];
    if (fileNameIndex) {
      if (needObjects) {
        objects = [];
        for (const record of Object.values(fileNameIndex)) {
          try {
            await this.checkGetPermission(record.obj.fullPath, record);
          } catch (e) {
            continue;
          }
          if (record.deleted == null) {
            objects.push(record.obj);
          }
        }
      }
      if (update) {
        await update(fileNameIndex);
        await this.putFileNameIndex(dirPath, fileNameIndex);
      }
    } else {
      objects = await this._getObjects(dirPath);
      fileNameIndex = {};
      for (const obj of objects) {
        if (obj.fullPath !== INDEX_FILE_PATH) {
          const record: Record = { obj: obj, updated: obj.lastModified };
          try {
            await this.checkAddPermission(obj.fullPath, record);
          } catch (e) {
            continue;
          }
          fileNameIndex[obj.name] = record;
        }
      }
      if (update) {
        await update(fileNameIndex);
      }
      await this.putFileNameIndex(dirPath, fileNameIndex);
    }
    return objects;
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
      const dirPath = getParentPath(fullPath);
      const index = await this.getFileNameIndex(dirPath);
      if (!index) {
        return;
      }
      record = index[fullPath];
      if (!record) {
        return;
      }
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
