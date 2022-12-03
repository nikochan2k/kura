import { AbstractAccessor } from "./AbstractAccessor";
import { NotImplementedError } from "./FileError";
import {
  EntryCallback,
  ErrorCallback,
  FileSystemCallback,
  LocalFileSystem,
} from "./filesystem";
import { INDEX_DIR } from "./FileSystemConstants";
import { FileSystemOptions } from "./FileSystemOptions";
import { onError } from "./FileSystemUtil";

if (window.TEMPORARY == null) {
  (window as any).TEMPORARY = 0;
}
if (window.PERSISTENT == null) {
  (window as any).PERSISTENT = 1;
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
            .doMakeDirectory({
              fullPath: INDEX_DIR,
              name: INDEX_DIR.substr(1),
            })
            .catch(() => {})
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
    throw new NotImplementedError("", url);
  }

  protected abstract createAccessor(): Promise<AbstractAccessor>;
}
