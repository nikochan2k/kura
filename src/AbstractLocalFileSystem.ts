import { AbstractAccessor } from "./AbstractAccessor";
import {
  EntryCallback,
  ErrorCallback,
  FileSystemCallback,
  LocalFileSystem
} from "./filesystem";
import { NotImplementedError } from "./FileError";
import { onError } from "./FileSystemUtil";

if (window.TEMPORARY == null) {
  window.TEMPORARY = 0;
}
if (window.PERSISTENT == null) {
  window.PERSISTENT = 1;
}

export abstract class AbstractLocalFileSystem implements LocalFileSystem {
  PERSISTENT: number;
  TEMPORARY: number;

  constructor(protected useIndex = false) {
    this.PERSISTENT = window.PERSISTENT;
    this.TEMPORARY = window.TEMPORARY;
  }

  requestFileSystem(
    type: number,
    size: number,
    successCallback: FileSystemCallback,
    errorCallback?: ErrorCallback | undefined
  ): void {
    this.createAccessor(this.useIndex)
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

  protected abstract createAccessor(
    useIndex: boolean
  ): Promise<AbstractAccessor>;
}
