import { IdbLocalFileSystem } from "./IdbLocalFileSystem";
import { LocalFileSystemAsync } from "../LocalFileSystemAsync";
import { Permission } from "../FileSystemIndex";

export class IdbLocalFileSystemAsync extends LocalFileSystemAsync {
  constructor(dbName: string);
  constructor(dbName: string, useIndex: boolean);
  constructor(dbName: string, permission: Permission);
  constructor(dbName: string, value?: any) {
    super(new IdbLocalFileSystem(dbName, value));
  }
}
