import {
  EntryCallback,
  ErrorCallback,
  FileSystemCallback,
  LocalFileSystem
} from "../filesystem";

if (window.TEMPORARY == null) {
  window.TEMPORARY = 0;
}
if (window.PERSISTENT == null) {
  window.PERSISTENT = 1;
}

export class DefaultLocalFileSystem implements LocalFileSystem {
  constructor() {
    this.requestFileSystem =
      window.requestFileSystem || window.webkitRequestFileSystem;
    this.resolveLocalFileSystemURL = window.resolveLocalFileSystemURL;
    this.TEMPORARY = window.TEMPORARY;
    this.PERSISTENT = window.PERSISTENT;
  }

  TEMPORARY: number;
  PERSISTENT: number;

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
}
