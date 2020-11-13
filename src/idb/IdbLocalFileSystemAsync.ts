import { FileSystemOptions } from "../FileSystemOptions";
import { LocalFileSystemAsync } from "../LocalFileSystemAsync";
import { IdbLocalFileSystem } from "./IdbLocalFileSystem";

export class IdbLocalFileSystemAsync extends LocalFileSystemAsync {
  // #region Constructors (1)

  constructor(dbName: string, options?: FileSystemOptions) {
    super(new IdbLocalFileSystem(dbName, options));
  }

  // #endregion Constructors (1)
}
