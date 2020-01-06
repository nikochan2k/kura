import { EmbeddedLocalFileSystem } from "../embedded/EmbeddedLocalFileSystem";
import { IdbLocalFileSystem } from "../idb/IdbLocalFileSystem";
import { LocalFileSystem } from "../filesystem";

export class DefaultLocalFileSystem implements LocalFileSystem {
  private localFileSystem: LocalFileSystem;

  PERSISTENT: number;
  TEMPORARY: number;

  constructor() {
    this.localFileSystem = new EmbeddedLocalFileSystem();
    if (!this.localFileSystem.requestFileSystem) {
      this.localFileSystem = new IdbLocalFileSystem("default");
    }
    this.TEMPORARY = window.TEMPORARY;
    this.PERSISTENT = window.PERSISTENT;
  }

  requestFileSystem(
    type: number,
    size: number,
    successCallback: import("../filesystem").FileSystemCallback,
    errorCallback?: import("../filesystem").ErrorCallback
  ): void {
    this.localFileSystem.requestFileSystem(
      type,
      size,
      successCallback,
      errorCallback
    );
  }

  resolveLocalFileSystemURL(
    url: string,
    successCallback: import("../filesystem").EntryCallback,
    errorCallback?: import("../filesystem").ErrorCallback
  ): void {
    this.localFileSystem.resolveLocalFileSystemURL(
      url,
      successCallback,
      errorCallback
    );
  }
}
