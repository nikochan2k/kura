import { FileSystemObject } from "./FileSystemObject";

export interface Record {
  name: string;
  deleted?: number;
  modified?: number;
  size?: number;

  [key: string]: any;
}

export interface RecordCacheEntry {
  lastModified: number;
  record: Record;
}

export type RecordCache = {
  [name: string]: RecordCacheEntry;
};

export interface FileNameIndex {
  [name: string]: Record;
}

export interface Event {
  postDelete?: (obj: FileSystemObject) => void;
  postGet?: (obj: FileSystemObject) => void;
  postHead?: (obj: FileSystemObject) => void;
  postPost?: (obj: FileSystemObject) => void;
  postPut?: (obj: FileSystemObject) => void;
  preDelete?: (obj: FileSystemObject) => Promise<boolean>;
  preGet?: (obj: FileSystemObject) => Promise<boolean>;
  preHead?: (obj: FileSystemObject) => Promise<boolean>;
  prePost?: (obj: FileSystemObject) => Promise<boolean>;
  prePut?: (obj: FileSystemObject) => Promise<boolean>;
}
