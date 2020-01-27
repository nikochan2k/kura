import { FileSystemObject } from "./FileSystemObject";

export interface Record {
  deleted?: number;
  obj: FileSystemObject;
  updated: number;

  [key: string]: any;
}

export interface FileSystemIndex {
  [key: string]: Record;
}

export interface Permission {
  onGet?: (record: Record) => boolean;
  onAdd?: (record: Record) => boolean;
  onUpdate?: (record: Record) => boolean;
  onDelete?: (record: Record) => boolean;
}
