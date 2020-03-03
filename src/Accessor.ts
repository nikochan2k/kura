import { FileSystemObject } from "./FileSystemObject";
import { DirPathIndex } from "./FileSystemIndex";

export interface Accessor {
  delete(fullPath: string, isFile: boolean): Promise<void>;
  deleteRecursively(fullPath: string): Promise<void>;
  getContent(fullPath: string): Promise<Blob>;
  getFileNameIndex(dirPath: string): Promise<DirPathIndex>;
  getObject(fullPath: string): Promise<FileSystemObject>;
  getObjects(dirPath: string): Promise<FileSystemObject[]>;
  putFileNameIndex(dirPath: string, index: DirPathIndex): Promise<void>;
  putObject(obj: FileSystemObject, content?: Blob): Promise<void>;
  resetObject(fullPath: string, size?: number): Promise<FileSystemObject>;
  toURL(fullPath: string): string;
  updateIndex(obj: FileSystemObject): Promise<void>;
}
