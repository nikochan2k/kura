import { EntryAsync } from "./EntryAsync";
import { NotImplementedError } from "./FileError";
import { Entry, LocalFileSystem } from "./filesystem";
import { FileSystemAsync } from "./FileSystemAsync";
import { AbstractFileSystem } from "./AbstractFileSystem";
import { AbstractAccessor } from "./AbstractAccessor";

export class LocalFileSystemAsync {
  // #region Constructors (1)

  constructor(public localFileSystem: LocalFileSystem) {}

  // #endregion Constructors (1)

  // #region Public Accessors (2)

  public get PERSISTENT() {
    return this.localFileSystem.PERSISTENT;
  }

  public get TEMPORARY() {
    return this.localFileSystem.TEMPORARY;
  }

  // #endregion Public Accessors (2)

  // #region Public Methods (2)

  public requestFileSystemAsync(
    type: number,
    size: number
  ): Promise<FileSystemAsync> {
    return new Promise<FileSystemAsync>((resolve, reject) => {
      this.localFileSystem.requestFileSystem(
        type,
        size,
        (filesystem) => {
          const afs = filesystem as AbstractFileSystem<AbstractAccessor>;
          resolve(new FileSystemAsync(afs));
        },
        (err) => reject(err)
      );
    });
  }

  public resolveLocalFileSystemAsyncURL(
    url: string
  ): Promise<EntryAsync<Entry>> {
    throw new NotImplementedError("", url);
  }

  // #endregion Public Methods (2)
}
