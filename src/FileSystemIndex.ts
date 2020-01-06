import { FileSystemObject } from "./FileSystemObject";

export interface Record {
  deleted?: number;
  obj: FileSystemObject;
  updated: number;
}

export interface FileSystemIndex {
  [key: string]: Record;
}
