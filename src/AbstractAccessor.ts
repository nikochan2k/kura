import { clearTimeout, setTimeout } from "timers";
import { Accessor } from "./Accessor";
import {
  InvalidModificationError,
  NoModificationAllowedError,
  NotFoundError,
  NotImplementedError
} from "./FileError";
import { FileSystem } from "./filesystem";
import { INDEX_FILE_PATH } from "./FileSystemConstants";
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

export abstract class AbstractAccessor implements Accessor {
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
    if (fullPath === "/") {
      return;
    }
    if (this.hasIndex) {
      const dirPath = getParentPath(fullPath);
      const name = getName(fullPath);
      await this.handleIndex(
        dirPath,
        false,
        async (fileNameIndex: FileNameIndex) => {
          let record = fileNameIndex[name];
          if (record) {
            await this.checkDeletePermission(fullPath, record);
            record.deleted = Date.now();
          }
          await this.doDelete(fullPath, isFile);
        }
      );
    } else {
      await this.doDelete(fullPath, isFile);
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
    await this.delete(fullPath, false);
  }

  async getContent(fullPath: string) {
    await this.checkGetPermission(fullPath);
    return this.doGetContent(fullPath);
  }

  async getFileNameIndex(dirPath: string) {
    if (this.dirPathIndex == null) {
      const blob = await this.doGetContent(INDEX_FILE_PATH);
      if (blob) {
        this.dirPathIndex = (await blobToObject(blob)) as DirPathIndex;
      } else {
        this.dirPathIndex = {};
      }
    }
    return this.dirPathIndex[dirPath];
  }

  async getObject(fullPath: string) {
    await this.checkGetPermission(fullPath);
    return this.doGetObject(fullPath);
  }

  async getObjects(dirPath: string) {
    return this.hasIndex
      ? await this.getObjectsFromIndex(dirPath)
      : await this.getObjectsFromDatabase(dirPath);
  }

  async putFileNameIndex(dirPath: string, fileNameIndex: FileNameIndex) {
    if (!this.dirPathIndex) {
      this.dirPathIndex = {};
    }
    this.dirPathIndex[dirPath] = fileNameIndex;
    if (this.putIndexTimeout) {
      if (window) {
        window.clearTimeout(this.putIndexTimeout as number);
      } else {
        clearTimeout(this.putIndexTimeout as NodeJS.Timeout);
      }
    }
    if (window) {
      this.putIndexTimeout = window.setTimeout(
        this.doPutDirPathIndex,
        AbstractAccessor.PUT_INDEX_THROTTLE
      );
    } else {
      this.putIndexTimeout = setTimeout(
        this.doPutDirPathIndex,
        AbstractAccessor.PUT_INDEX_THROTTLE
      );
    }
  }

  async putObject(obj: FileSystemObject, content?: Blob) {
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

  protected doPutDirPathIndex() {
    const blob = objectToBlob(this.dirPathIndex);
    this.doPutContent(INDEX_FILE_PATH, blob);
  }

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
    return await this.handleIndex(dirPath, true);
  }

  protected async handleIndex(
    dirPath: string,
    needObjects: boolean,
    update?: (fileNameIndex: FileNameIndex) => Promise<void>
  ) {
    const fileNameIndex = await this.getFileNameIndex(dirPath);
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
      const fileNameIndex: FileNameIndex = {};
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
