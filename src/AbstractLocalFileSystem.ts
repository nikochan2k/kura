import {
  EntryCallback,
  ErrorCallback,
  FileSystemCallback,
  LocalFileSystem
} from "./filesystem";

export abstract class AbstractLocalFileSystem implements LocalFileSystem {
  constructor(
    public bucket: string,
    protected useIndex = false,
    public PERSISTENT = window.PERSISTENT,
    public TEMPORARY = window.TEMPORARY
  ) {}

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
