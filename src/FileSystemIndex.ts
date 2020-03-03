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

export interface Permission {
  onGet?: (record: Record) => boolean;
  onAdd?: (record: Record) => boolean;
  onUpdate?: (record: Record) => boolean;
  onDelete?: (record: Record) => boolean;
}
