import { FileSystemObject } from "./FileSystemObject";

export interface Record {
  deleted?: number;
  obj: FileSystemObject;
  updated: number;

  [key: string]: any;
}

export interface FileNameIndex {
  [name: string]: Record;
}

export interface DirPathIndex {
  [dirPath: string]: FileNameIndex;
}

export interface Event {
  preGet?: (record: Record) => Promise<boolean>;
  preAdd?: (record: Record) => Promise<boolean>;
  preUpdate?: (record: Record) => Promise<boolean>;
  preDelete?: (record: Record) => Promise<boolean>;
  postGet?: (record: Record) => void;
  postAdd?: (record: Record) => void;
  postUpdate?: (record: Record) => void;
  postDelete?: (record: Record) => void;
}
