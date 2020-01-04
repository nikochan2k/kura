import {
  EntryCallback,
  ErrorCallback,
  FileSystemCallback,
  LocalFileSystem
} from "./filesystem";

export abstract class AbstractLocalFileSystem implements LocalFileSystem {
  constructor(public bucket: string) {}

  get TEMPORARY() {
    return window.TEMPORARY;
  }
  get PERSISTENT() {
    return window.PERSISTENT;
  }

  abstract requestFileSystem(
    type: number,
    size: number,
    successCallback: FileSystemCallback,
    errorCallback?: ErrorCallback
  ): void;

  abstract resolveLocalFileSystemURL(
    url: string,
    successCallback: EntryCallback,
    errorCallback?: ErrorCallback
  ): void;
}
