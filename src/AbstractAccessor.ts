import { FileSystemObject } from "./FileSystemObject";
import { FileSystemIndex } from "./FileSystemIndex";

export abstract class AbstractAccessor {
  constructor(protected useIndex: boolean) {}

  async getObjects(dirPath: string) {
    return this.useIndex
      ? await this.getObjectsFromIndex(dirPath)
      : await this.getObjectsFromDatabase(dirPath);
  }

  abstract delete(fullPath: string): Promise<void>;
  abstract deleteRecursively(fullPath: string): Promise<void>;
  abstract getContent(fullPath: string): Promise<any>;
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
