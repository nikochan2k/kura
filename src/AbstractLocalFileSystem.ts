import { AbstractAccessor } from "./AbstractAccessor";
import {
  EntryCallback,
  ErrorCallback,
  FileSystemCallback,
  LocalFileSystem
} from "./filesystem";
import { NotImplementedError } from "./FileError";
import { onError } from "./FileSystemUtil";
import { Permission } from "./FileSystemIndex";

if (window.TEMPORARY == null) {
  (window as any).TEMPORARY = 0;
}
if (window.PERSISTENT == null) {
  (window as any).PERSISTENT = 1;
}

export abstract class AbstractLocalFileSystem implements LocalFileSystem {
  PERSISTENT: number;
  TEMPORARY: number;
  protected permission: Permission;

  constructor();
  constructor(useIndex: boolean);
  constructor(permission: Permission);
  constructor(config?: any) {
    if (config) {
      if (typeof config === "object") {
        this.permission = config;
      } else if (config === true) {
        this.permission = {};
      }
    }
    this.PERSISTENT = window.PERSISTENT;
    this.TEMPORARY = window.TEMPORARY;
  }

  requestFileSystem(
    type: number,
    size: number,
    successCallback: FileSystemCallback,
    errorCallback?: ErrorCallback | undefined
  ): void {
    this.createAccessor()
      .then(accessor => {
        successCallback(accessor.filesystem);
      })
      .catch(err => {
        onError(err, errorCallback);
      });
  }

  resolveLocalFileSystemURL(
    url: string,
    successCallback: EntryCallback,
    errorCallback?: ErrorCallback | undefined
  ): void {
    throw new NotImplementedError("", url);
  }

  protected abstract createAccessor(): Promise<AbstractAccessor>;
}
