import { InvalidModificationError, NotFoundError } from "./FileError";
import { FileSystem } from "./filesystem";
import { INDEX_FILE_NAME } from "./FileSystemConstants";
import { FileSystemIndex, Permission, Record } from "./FileSystemIndex";
import { FileSystemObject } from "./FileSystemObject";
import {
  blobToObject,
  createPath,
  getParentPath,
  objectToBlob
} from "./FileSystemUtil";

export abstract class AbstractAccessor {
  abstract readonly filesystem: FileSystem;
  readonly hasIndex: boolean;
  abstract readonly name: string;

  constructor(public readonly permission: Permission) {
    this.hasIndex = this.permission ? true : false;
  }

  async delete(fullPath: string, isFile: boolean) {
    if (fullPath === "/") {
      return;
    }
    if (this.hasIndex) {
      const dirPath = getParentPath(fullPath);
      await this.handleIndex(dirPath, false, async (index: FileSystemIndex) => {
        let record = index[fullPath];
        if (record) {
          await this.checkDeletePermission(fullPath, record);
          record.deleted = Date.now();
        }
        await this.doDelete(fullPath, isFile);
      });
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

  public async getIndex(dirPath: string) {
    const indexPath = createPath(dirPath, INDEX_FILE_NAME);
    const blob = await this.doGetContent(indexPath);
    const index = (await blobToObject(blob)) as FileSystemIndex;
    return index;
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

  async putIndex(dirPath: string, index: FileSystemIndex) {
    const blob = objectToBlob(index);
    const indexPath = createPath(dirPath, INDEX_FILE_NAME);
    await this.doPutContent(indexPath, blob);
  }

  async putObject(obj: FileSystemObject, content?: Blob) {
    if (this.hasIndex && obj.name === INDEX_FILE_NAME) {
      throw new InvalidModificationError(
        this.name,
        obj.fullPath,
        `cannot write to index file "${INDEX_FILE_NAME}"`
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

  async updateIndex(obj: FileSystemObject) {
    const dirPath = getParentPath(obj.fullPath);
    await this.handleIndex(dirPath, false, async (index: FileSystemIndex) => {
      let record = index[obj.fullPath];
      if (!record) {
        record = { obj: obj, updated: Date.now() };
        await this.checkAddPermission(obj.fullPath, record);
        index[obj.fullPath] = record;
      } else {
        record.obj = obj;
        record.updated = Date.now();
        await this.checkUpdatePermission(obj.fullPath, record);
      }
      delete record.deleted;
    });
  }

  protected async getObjectsFromDatabase(dirPath: string) {
    const objects = await this.doGetObjects(dirPath);
    const newObjects: FileSystemObject[] = [];
    for (const obj of objects) {
      if (obj.name === INDEX_FILE_NAME) {
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
    update?: (index: FileSystemIndex) => Promise<void>
  ) {
    const index = await this.getIndex(dirPath);
    let objects: FileSystemObject[];
    if (index) {
      if (needObjects) {
        objects = [];
        for (const record of Object.values(index)) {
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
        await update(index);
        await this.putIndex(dirPath, index);
      }
    } else {
      objects = await this.doGetObjects(dirPath);
      const index: FileSystemIndex = {};
      for (const obj of objects) {
        if (obj.name !== INDEX_FILE_NAME) {
          const record: Record = { obj: obj, updated: obj.lastModified };
          try {
            await this.checkAddPermission(obj.fullPath, record);
          } catch (e) {
            continue;
          }
          index[obj.fullPath] = record;
        }
      }
      if (update) {
        await update(index);
      }
      await this.putIndex(dirPath, index);
    }
    return objects;
  }

  protected abstract doDelete(fullPath: string, isFile: boolean): Promise<void>;
  protected abstract doGetContent(fullPath: string): Promise<Blob>;
  protected abstract doGetObject(fullPath: string): Promise<FileSystemObject>;
  protected abstract doGetObjects(
    fullPath: string
  ): Promise<FileSystemObject[]>;
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
      throw new InvalidModificationError(this.name, fullPath, "Cannot add");
    }
  }

  private async checkDeletePermission(fullPath: string, record: Record) {
    if (!this.permission.onDelete) {
      return;
    }
    if (!this.permission.onDelete(record)) {
      throw new InvalidModificationError(this.name, fullPath, "Cannot delete");
    }
  }

  private async checkGetPermission(fullPath: string, record?: Record) {
    if (!this.hasIndex) {
      return;
    }
    if (!record) {
      const dirPath = getParentPath(fullPath);
      const index = await this.getIndex(dirPath);
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
      throw new InvalidModificationError(this.name, fullPath, "Cannot update");
    }
  }
}
