import { EmbeddedLocalFileSystem } from "../embedded/EmbeddedLocalFileSystem";
import {
  EntryCallback,
  ErrorCallback,
  FileSystemCallback,
  LocalFileSystem,
} from "../filesystem";
import { IdbLocalFileSystem } from "../idb/IdbLocalFileSystem";

export class DefaultLocalFileSystem implements LocalFileSystem {
  private localFileSystem: LocalFileSystem;

  public PERSISTENT: number;
  public TEMPORARY: number;

  constructor() {
    this.localFileSystem = new EmbeddedLocalFileSystem();
    if (!this.localFileSystem.requestFileSystem) {
      this.localFileSystem = new IdbLocalFileSystem("default");
    }
    this.TEMPORARY = window.TEMPORARY;
    this.PERSISTENT = window.PERSISTENT;
  }

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
}
