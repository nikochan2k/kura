import {
  EntryCallback,
  ErrorCallback,
  FileSystemCallback,
  LocalFileSystem,
} from "../filesystem";

export class EmbeddedLocalFileSystem implements LocalFileSystem {
  PERSISTENT: number;
  TEMPORARY: number;

  requestFileSystem: (
    type: number,
    size: number,
    successCallback: FileSystemCallback,
    errorCallback?: ErrorCallback
  ) => void;

  resolveLocalFileSystemURL: (
    url: string,
    successCallback: EntryCallback,
    errorCallback?: ErrorCallback
  ) => void;

  constructor() {
    this.requestFileSystem =
      window.requestFileSystem || window.webkitRequestFileSystem;
    this.resolveLocalFileSystemURL = window.resolveLocalFileSystemURL;
    this.TEMPORARY = window.TEMPORARY;
    this.PERSISTENT = window.PERSISTENT;
  }
}
