import { EmbeddedLocalFileSystem } from "./EmbeddedLocalFileSystem";
import { LocalFileSystemAsync } from "../LocalFileSystemAsync";

export class EmbeddedLocalFileSystemAsync extends LocalFileSystemAsync {
  // #region Constructors (1)

  constructor() {
    super(new EmbeddedLocalFileSystem());
  }

  // #endregion Constructors (1)
}
