import { FileSystem } from "./filesystem";
import { FileSystemIndex } from "./FileSystemIndex";
import { FileSystemObject } from "./FileSystemObject";

export abstract class AbstractAccessor {
  abstract filesystem: FileSystem;
  abstract name: string;

  constructor(protected useIndex: boolean) {}

  async getObjects(dirPath: string) {
    return this.useIndex
      ? await this.getObjectsFromIndex(dirPath)
      : await this.getObjectsFromDatabase(dirPath);
  }

  abstract delete(fullPath: string): Promise<void>;
  abstract deleteRecursively(fullPath: string): Promise<void>;
  abstract getContent(fullPath: string): Promise<any>;
  abstract getObject(fullPath: string): Promise<FileSystemObject>;
  abstract getObjectsFromDatabase(
    fullPath: string
  ): Promise<FileSystemObject[]>;
  abstract getObjectsFromIndex(dirPath: string): Promise<FileSystemObject[]>;
  abstract hasChild(fullPath: string): Promise<boolean>;
  abstract putContent(fullPath: string, content: any): Promise<void>;
  abstract putIndex(
    dirPath: string,
    update: (index: FileSystemIndex) => void
  ): Promise<void>;
  abstract putObject(obj: FileSystemObject): Promise<void>;
}
