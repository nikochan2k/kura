import { FileSystemObject } from "./FileSystemObject";

export interface Record {
  obj: FileSystemObject;
  modified: number;
  deleted?: number;
  [key: string]: any;
}

export interface FileNameIndex {
  [name: string]: Record;
}

export interface DirPathIndex {
  [dirPath: string]: FileNameIndex;
}

export interface Event {
  preHead?: (record: Record) => Promise<boolean>;
  preGet?: (record: Record) => Promise<boolean>;
  prePost?: (record: Record) => Promise<boolean>;
  prePut?: (record: Record) => Promise<boolean>;
  preDelete?: (record: Record) => Promise<boolean>;
  postHead?: (record: Record) => void;
  postGet?: (record: Record) => void;
  postPost?: (record: Record) => void;
  postPut?: (record: Record) => void;
  postDelete?: (record: Record) => void;
}
