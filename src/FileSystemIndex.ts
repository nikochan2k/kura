import { Entry } from "./filesystem";
import { FileSystemObject } from "./FileSystemObject";

export interface Record {
  obj: FileSystemObject;
  updated: number;
  deleted?: number;
}

export interface FileSystemIndex {
  [key: string]: Record;
}
