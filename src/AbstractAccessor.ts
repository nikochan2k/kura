import { InvalidModificationError, InvalidStateError } from "./FileError";
import { FileSystem } from "./filesystem";
import { INDEX_FILE_NAME } from "./FileSystemConstants";
import { FileSystemIndex } from "./FileSystemIndex";
import { FileSystemObject } from "./FileSystemObject";
import {
  blobToObject,
  createPath,
  getParentPath,
  objectToBlob
} from "./FileSystemUtil";

export abstract class AbstractAccessor {
  abstract readonly filesystem: FileSystem;
  abstract readonly name: string;

  constructor(public readonly useIndex: boolean) {}

  async delete(fullPath: string, isFile: boolean) {
    if (fullPath === "/") {
      return;
    }
    await this.doDelete(fullPath, isFile);
    if (this.useIndex) {
      const dirPath = getParentPath(fullPath);
      await this.handleIndex(dirPath, false, (index: FileSystemIndex) => {
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
      await this.delete(obj.fullPath, true);
    }
    await this.delete(fullPath, false);
  }

  public async getIndex(dirPath: string) {
    const indexPath = createPath(dirPath, INDEX_FILE_NAME);
    const blob = await this.getContent(indexPath);
    const index = (await blobToObject(blob)) as FileSystemIndex;
    return index;
  }

  async getObjects(dirPath: string) {
    return this.useIndex
      ? await this.getObjectsFromIndex(dirPath)
      : await this.getObjectsFromDatabase(dirPath);
  }

  async putIndex(dirPath: string, index: FileSystemIndex) {
    const blob = objectToBlob(index);
    const indexPath = createPath(dirPath, INDEX_FILE_NAME);
    await this.doPutContent(indexPath, blob);
  }

  async putObject(obj: FileSystemObject, content?: Blob) {
    if (this.useIndex && obj.name === INDEX_FILE_NAME) {
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
    if (this.useIndex) {
      await this.updateIndex(obj);
    }
  }

  abstract getContent(fullPath: string): Promise<Blob>;
  abstract getObject(fullPath: string): Promise<FileSystemObject>;

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

    const index = await this.getIndex(dirPath);
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
        await this.putIndex(dirPath, index);
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
      await this.putIndex(dirPath, index);
    }
    return objects;
  }

  protected async updateIndex(obj: FileSystemObject) {
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

  protected abstract doDelete(fullPath: string, isFile: boolean): Promise<void>;
  protected abstract doGetObjects(
    fullPath: string
  ): Promise<FileSystemObject[]>;
  protected abstract doPutContent(
    fullPath: string,
    content: Blob
  ): Promise<void>;
  protected abstract doPutObject(obj: FileSystemObject): Promise<void>;
}
