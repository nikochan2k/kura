import { AbstractAccessor } from "./AbstractAccessor";
import { NotImplementedError } from "./FileError";
import {
  EntryCallback,
  ErrorCallback,
  FileSystemCallback,
  LocalFileSystem,
} from "./filesystem";
import { INDEX_DIR_PATH } from "./FileSystemConstants";
import { FileSystemOptions } from "./FileSystemOptions";
import { onError } from "./FileSystemUtil";

if (window.TEMPORARY == null) {
  (window as any).TEMPORARY = 0; // eslint-disable-line
}
if (window.PERSISTENT == null) {
  (window as any).PERSISTENT = 1; // eslint-disable-line
}

export abstract class AbstractLocalFileSystem implements LocalFileSystem {
  public PERSISTENT: number;
  public TEMPORARY: number;

  constructor(protected options: FileSystemOptions = {}) {
    if (options.event == null) options.event = {};
    if (options.verbose == null) options.verbose = false;
    this.PERSISTENT = window.PERSISTENT;
    this.TEMPORARY = window.TEMPORARY;
  }

  public requestFileSystem(
    type: number,
    size: number,
    successCallback: FileSystemCallback,
    errorCallback?: ErrorCallback | undefined
  ): void {
    this.createAccessor()
      .then((accessor) => {
        if (accessor.options.index) {
          accessor
            .doMakeDirectory(INDEX_DIR_PATH)
            .catch(() => {
              // noop
            })
            .finally(() => successCallback(accessor.filesystem));
        } else {
          successCallback(accessor.filesystem);
        }
      })
      .catch((err) => {
        onError(err, errorCallback);
      });
  }

  public resolveLocalFileSystemURL(
    url: string,
    successCallback: EntryCallback,
    errorCallback?: ErrorCallback | undefined
  ): void {
    errorCallback(new NotImplementedError("", url));
  }

  protected abstract createAccessor(): Promise<AbstractAccessor>;
}
