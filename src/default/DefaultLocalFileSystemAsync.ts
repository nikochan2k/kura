import { DefaultLocalFileSystem } from "./DefaultLocalFileSystem";
import { LocalFileSystemAsync } from "../LocalFileSystemAsync";

export class DefaultLocalFileSystemAsync extends LocalFileSystemAsync {
  // #region Constructors (1)

  constructor() {
    super(new DefaultLocalFileSystem());
  }

  // #endregion Constructors (1)
}
