import {
  EntryCallback,
  ErrorCallback,
  FileSystemCallback,
  LocalFileSystem,
} from "../filesystem";

export class EmbeddedLocalFileSystem implements LocalFileSystem {
  // #region Properties (4)

  public PERSISTENT: number;
  public TEMPORARY: number;
  public requestFileSystem: (
    type: number,
    size: number,
    successCallback: FileSystemCallback,
    errorCallback?: ErrorCallback
  ) => void;
  public resolveLocalFileSystemURL: (
    url: string,
    successCallback: EntryCallback,
    errorCallback?: ErrorCallback
  ) => void;

  // #endregion Properties (4)

  // #region Constructors (1)

  constructor() {
    this.requestFileSystem =
      window.requestFileSystem || window.webkitRequestFileSystem;
    this.resolveLocalFileSystemURL = window.resolveLocalFileSystemURL;
    this.TEMPORARY = window.TEMPORARY;
    this.PERSISTENT = window.PERSISTENT;
  }

  // #endregion Constructors (1)
}
