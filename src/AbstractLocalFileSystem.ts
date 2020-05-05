import { AbstractAccessor } from "./AbstractAccessor";
import { NotImplementedError } from "./FileError";
import {
  EntryCallback,
  ErrorCallback,
  FileSystemCallback,
  LocalFileSystem,
} from "./filesystem";
import { FileSystemOptions } from "./FileSystemOptions";
import { onError } from "./FileSystemUtil";

if (window.TEMPORARY == null) {
  (window as any).TEMPORARY = 0;
}
if (window.PERSISTENT == null) {
  (window as any).PERSISTENT = 1;
}

export abstract class AbstractLocalFileSystem implements LocalFileSystem {
  PERSISTENT: number;
  TEMPORARY: number;

  constructor(protected options: FileSystemOptions = {}) {
    if (options.permission == null) options.permission = {};
    if (options.verbose == null) options.verbose = false;
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
      .then((accessor) => {
        successCallback(accessor.filesystem);
      })
      .catch((err) => {
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
