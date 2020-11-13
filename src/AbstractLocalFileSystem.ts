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
  // #region Properties (2)

  public PERSISTENT: number;
  public TEMPORARY: number;

  // #endregion Properties (2)

  // #region Constructors (1)

  constructor(protected options: FileSystemOptions = {}) {
    if (options.event == null) options.event = {};
    if (options.verbose == null) options.verbose = false;
    this.PERSISTENT = window.PERSISTENT;
    this.TEMPORARY = window.TEMPORARY;
  }

  // #endregion Constructors (1)

  // #region Public Methods (2)

  public requestFileSystem(
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

  public resolveLocalFileSystemURL(
    url: string,
    successCallback: EntryCallback,
    errorCallback?: ErrorCallback | undefined
  ): void {
    throw new NotImplementedError("", url);
  }

  // #endregion Public Methods (2)

  // #region Protected Abstract Methods (1)

  protected abstract createAccessor(): Promise<AbstractAccessor>;

  // #endregion Protected Abstract Methods (1)
}
