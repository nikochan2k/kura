import { FileSystem } from "./filesystem";
import { FileSystemIndex } from "./FileSystemIndex";
import { FileSystemObject } from "./FileSystemObject";

export abstract class AbstractAccessor {
  abstract filesystem: FileSystem;
  abstract name: string;

  constructor(protected useIndex: boolean) {}

  async delete(fullPath: string) {
    await this.doDelete(fullPath);
  }

  async deleteRecursively(fullPath: string) {
    await this.doDeleteRecursively(fullPath);
  }

  async getObjects(dirPath: string) {
    return this.useIndex
      ? await this.getObjectsFromIndex(dirPath)
      : await this.getObjectsFromDatabase(dirPath);
  }

  async putContent(fullPath: string, content: Blob) {
    await this.doPutContent(fullPath, content);
  }

  async putObject(obj: FileSystemObject) {
    await this.doPutObject(obj);
  }

  abstract getContent(fullPath: string): Promise<Blob>;
  abstract getObject(fullPath: string): Promise<FileSystemObject>;
  abstract getObjectsFromDatabase(
    fullPath: string
  ): Promise<FileSystemObject[]>;
  abstract getObjectsFromIndex(dirPath: string): Promise<FileSystemObject[]>;
  abstract hasChild(fullPath: string): Promise<boolean>;
  abstract putIndex(
    dirPath: string,
    update: (index: FileSystemIndex) => void
  ): Promise<void>;

  protected abstract doDelete(fullPath: string): Promise<void>;
  protected abstract doDeleteRecursively(fullPath: string): Promise<void>;
  protected abstract doPutContent(
    fullPath: string,
    content: Blob
  ): Promise<void>;
  protected abstract doPutObject(obj: FileSystemObject): Promise<void>;
}
