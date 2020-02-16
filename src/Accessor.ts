import { FileSystemIndex } from "./FileSystemIndex";
import { FileSystemObject } from "./FileSystemObject";

export interface Accessor {
  delete(fullPath: string, isFile: boolean): Promise<void>;
  deleteRecursively(fullPath: string): Promise<void>;
  getContent(fullPath: string): Promise<Blob>;
  getIndex(dirPath: string): Promise<FileSystemIndex>;
  getObject(fullPath: string): Promise<FileSystemObject>;
  getObjects(dirPath: string): Promise<FileSystemObject[]>;
  putIndex(dirPath: string, index: FileSystemIndex): Promise<void>;
  putObject(obj: FileSystemObject, content?: Blob): Promise<void>;
  resetObject(fullPath: string, size?: number): Promise<FileSystemObject>;
  toURL(fullPath: string): string;
  updateIndex(obj: FileSystemObject): Promise<void>;
}
