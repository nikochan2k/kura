import {
  blobToObject,
  createPath,
  getParentPath,
  objectToBlob
} from "./FileSystemUtil";
import { FileSystem } from "./filesystem";
import { FileSystemIndex } from "./FileSystemIndex";
import { FileSystemObject } from "./FileSystemObject";
import { INDEX_FILE_NAME } from "./FileSystemConstants";
import { InvalidStateError } from "./FileError";

export abstract class AbstractAccessor {
  abstract filesystem: FileSystem;
  abstract name: string;

  constructor(protected useIndex: boolean) {}

  async delete(fullPath: string) {
    await this.doDelete(fullPath);
    if (this.useIndex) {
      const dirPath = getParentPath(fullPath);
      this.handleIndex(dirPath, false, (index: FileSystemIndex) => {
        let record = index[fullPath];
        if (record) {
          record.deleted = Date.now();
        }
      });
    }
  }

  async deleteRecursively(fullPath: string) {
    const objects = await this.getObjects(fullPath);
    for (const obj of objects) {
      if (obj.size == null) {
        await this.deleteRecursively(obj.fullPath);
        continue;
      }
      await this.delete(obj.fullPath);
    }
    await this.delete(fullPath);
  }

  async getObjects(dirPath: string) {
    return this.useIndex
      ? await this.getObjectsFromIndex(dirPath)
      : await this.getObjectsFromDatabase(dirPath);
  }

  async putIndex(obj: FileSystemObject) {
    const dirPath = getParentPath(obj.fullPath);
    await this.handleIndex(dirPath, false, (index: FileSystemIndex) => {
      let record = index[obj.fullPath];
      if (!record) {
        record = { obj: obj, updated: Date.now() };
        index[obj.fullPath] = record;
      } else {
        record.updated = Date.now();
      }
      delete record.deleted;
    });
  }

  async putObject(obj: FileSystemObject, content?: Blob) {
    await this.doPutObject(obj);
    if (content) {
      await this.doPutContent(obj.fullPath, content);
    }
    if (this.useIndex) {
      await this.putIndex(obj);
    }
  }

  abstract getContent(fullPath: string): Promise<Blob>;
  abstract getObject(fullPath: string): Promise<FileSystemObject>;
  abstract hasChild(fullPath: string): Promise<boolean>;

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
    update?: (index: FileSystemIndex) => void
  ) {
    if (!this.useIndex) {
      throw new InvalidStateError(this.name, dirPath, "useIndex");
    }

    const indexPath = createPath(dirPath, INDEX_FILE_NAME);
    const blob = await this.getContent(indexPath);
    const index = (await blobToObject(blob)) as FileSystemIndex;

    let objects: FileSystemObject[];
    if (index) {
      if (needObjects) {
        objects = [];
        for (const record of Object.values(index)) {
          if (record.deleted == null) {
            objects.push(record.obj);
          }
        }
      }
      if (update) {
        update(index);
        const blob = objectToBlob(index);
        await this.doPutContent(indexPath, blob);
      }
    } else {
      objects = await this.doGetObjects(dirPath);
      const index: FileSystemIndex = {};
      for (const obj of objects) {
        if (obj.name !== INDEX_FILE_NAME) {
          index[obj.fullPath] = { obj: obj, updated: obj.lastModified };
        }
      }
      if (update) {
        update(index);
      }
      const blob = objectToBlob(index);
      await this.doPutContent(indexPath, blob);
    }
    return objects;
  }

  protected abstract doDelete(fullPath: string): Promise<void>;
  protected abstract doGetObjects(
    fullPath: string
  ): Promise<FileSystemObject[]>;
  protected abstract doPutContent(
    fullPath: string,
    content: Blob
  ): Promise<void>;
  protected abstract doPutObject(obj: FileSystemObject): Promise<void>;
}
