import { FileSystemOptions } from "../FileSystemOptions";
import { LocalFileSystemAsync } from "../LocalFileSystemAsync";
import { IdbLocalFileSystem } from "./IdbLocalFileSystem";

export class IdbLocalFileSystemAsync extends LocalFileSystemAsync {
  constructor(dbName: string, options?: FileSystemOptions) {
    super(new IdbLocalFileSystem(dbName, options));
  }
}
