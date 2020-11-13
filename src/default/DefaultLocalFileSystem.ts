import { EmbeddedLocalFileSystem } from "../embedded/EmbeddedLocalFileSystem";
import {
  EntryCallback,
  ErrorCallback,
  FileSystemCallback,
  LocalFileSystem,
} from "../filesystem";
import { IdbLocalFileSystem } from "../idb/IdbLocalFileSystem";

export class DefaultLocalFileSystem implements LocalFileSystem {
  // #region Properties (3)

  private localFileSystem: LocalFileSystem;

  public PERSISTENT: number;
  public TEMPORARY: number;

  // #endregion Properties (3)

  // #region Constructors (1)

  constructor() {
    this.localFileSystem = new EmbeddedLocalFileSystem();
    if (!this.localFileSystem.requestFileSystem) {
      this.localFileSystem = new IdbLocalFileSystem("default");
    }
    this.TEMPORARY = window.TEMPORARY;
    this.PERSISTENT = window.PERSISTENT;
  }

  // #endregion Constructors (1)

  // #region Public Methods (2)

  public requestFileSystem(
    type: number,
    size: number,
    successCallback: FileSystemCallback,
    errorCallback?: ErrorCallback
  ): void {
    this.localFileSystem.requestFileSystem(
      type,
      size,
      successCallback,
      errorCallback
    );
  }

  public resolveLocalFileSystemURL(
    url: string,
    successCallback: EntryCallback,
    errorCallback?: ErrorCallback
  ): void {
    this.localFileSystem.resolveLocalFileSystemURL(
      url,
      successCallback,
      errorCallback
    );
  }

  // #endregion Public Methods (2)
}
