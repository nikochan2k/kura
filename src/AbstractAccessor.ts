import { clearTimeout, setTimeout } from "timers";
import {
  InvalidModificationError,
  NoModificationAllowedError,
  NotFoundError,
  NotImplementedError
} from "./FileError";
import { FileSystem } from "./filesystem";
import { DIR_SEPARATOR, INDEX_FILE_PATH } from "./FileSystemConstants";
import {
  DirPathIndex,
  FileNameIndex,
  Permission,
  Record
} from "./FileSystemIndex";
import { FileSystemObject } from "./FileSystemObject";
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
  readonly hasIndex: boolean;
  abstract readonly name: string;

  static PUT_INDEX_THROTTLE = 3000;

  constructor(public readonly permission: Permission) {
    this.hasIndex = this.permission ? true : false;
  }

  async delete(fullPath: string, isFile: boolean) {
    if (fullPath === DIR_SEPARATOR) {
      return;
    }
    if (this.hasIndex) {
      const record = await this.getRecord(fullPath);
      if (!record || record.deleted) {
        return;
      }
      await this.checkDeletePermission(fullPath, record);
      const dirPath = getParentPath(fullPath);
      await this.handleIndex(dirPath, false, async () => {
        record.deleted = Date.now();
        await this.doDelete(fullPath, isFile);
      });
    } else {
      await this.doDelete(fullPath, isFile);
    }
  }

  async deleteRecursively(fullPath: string) {
    if (this.hasIndex && fullPath !== DIR_SEPARATOR) {
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
    if (this.hasIndex) {
      const record = await this.getRecord(fullPath);
      if (!record || record.deleted) {
        return null;
      }
    }
    return this.doGetContent(fullPath);
  }

  async getDirPathIndex() {
    if (!this.hasIndex) {
      throw new Error("No index");
    }
    if (this.dirPathIndex == null) {
      const blob = await this.doGetContent(INDEX_FILE_PATH);
      if (blob) {
        this.dirPathIndex = (await blobToObject(blob)) as DirPathIndex;
      } else {
        this.dirPathIndex = {};
      }
    }
    return this.dirPathIndex;
  }

  async getFileNameIndex(dirPath: string) {
    if (!this.hasIndex) {
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
    if (this.hasIndex) {
      const record = await this.getRecord(fullPath);
      if (!record || record.deleted) {
        return null;
      }
    }
    return this.doGetObject(fullPath);
  }

  async getObjects(dirPath: string) {
    return this.hasIndex
      ? await this.getObjectsFromIndex(dirPath)
      : await this.getObjectsFromDatabase(dirPath);
  }

  async getRecord(fullPath: string) {
    if (!this.hasIndex) {
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
    if (!this.hasIndex) {
      throw new Error("No index");
    }
    const blob = objectToBlob(dirPathIndex);
    await this.doPutContent(INDEX_FILE_PATH, blob);
  }

  async putFileNameIndex(dirPath: string, fileNameIndex: FileNameIndex) {
    if (!this.hasIndex) {
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
    if (this.hasIndex && obj.fullPath === INDEX_FILE_PATH) {
      throw new InvalidModificationError(
        this.name,
        obj.fullPath,
        `cannot write to index file "${INDEX_FILE_PATH}"`
      );
    }

    await this.doPutObject(obj);
    if (content) {
      await this.doPutContent(obj.fullPath, content);
    }
    if (this.hasIndex) {
      await this.updateIndex(obj);
    }
  }

  async resetObject(fullPath: string, size?: number) {
    if (fullPath === DIR_SEPARATOR) {
      return null;
    }
    const obj = await this.doGetObject(fullPath);
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
    if (!this.hasIndex) {
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

  abstract doDelete(fullPath: string, isFile: boolean): Promise<void>;
  abstract doGetContent(fullPath: string): Promise<Blob>;
  abstract doGetObject(fullPath: string): Promise<FileSystemObject>;
  abstract doGetObjects(dirPath: string): Promise<FileSystemObject[]>;
  abstract doPutContent(fullPath: string, content: Blob): Promise<void>;
  abstract doPutObject(obj: FileSystemObject): Promise<void>;

  protected async getObjectsFromDatabase(dirPath: string) {
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
      objects = await this.doGetObjects(dirPath);
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

  private async checkAddPermission(fullPath: string, record: Record) {
    if (!this.permission.onAdd) {
      return;
    }
    if (!this.permission.onAdd(record)) {
      throw new NoModificationAllowedError(this.name, fullPath, "Cannot add");
    }
  }

  private async checkDeletePermission(fullPath: string, record: Record) {
    if (!this.permission.onDelete) {
      return;
    }
    if (!this.permission.onDelete(record)) {
      throw new NoModificationAllowedError(
        this.name,
        fullPath,
        "Cannot delete"
      );
    }
  }

  private async checkGetPermission(fullPath: string, record?: Record) {
    if (!this.hasIndex) {
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

    if (!this.permission.onGet) {
      return;
    }
    if (!this.permission.onGet(record)) {
      throw new NotFoundError(this.name, fullPath);
    }
  }

  private async checkUpdatePermission(fullPath: string, record: Record) {
    if (!this.permission.onUpdate) {
      return;
    }
    if (!this.permission.onUpdate(record)) {
      throw new NoModificationAllowedError(
        this.name,
        fullPath,
        "Cannot update"
      );
    }
  }
}
