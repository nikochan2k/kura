import { AbstractAccessor } from "./AbstractAccessor";
import { InvalidModificationError } from "./FileError";
import {
  DirectoryEntry,
  DirectoryEntryCallback,
  Entry,
  EntryCallback,
  ErrorCallback,
  MetadataCallback,
  VoidCallback,
} from "./filesystem";
import { DIR_SEPARATOR } from "./FileSystemConstants";
import { FileSystemObject } from "./FileSystemObject";
import { FileSystemParams } from "./FileSystemParams";
import {
  createFileSystemObject,
  getParentPath,
  onError,
} from "./FileSystemUtil";

export abstract class AbstractEntry<T extends AbstractAccessor>
  implements Entry {
  // #region Properties (2)

  public abstract isDirectory: boolean;
  public abstract isFile: boolean;

  // #endregion Properties (2)

  // #region Constructors (1)

  constructor(public params: FileSystemParams<T>) {}

  // #endregion Constructors (1)

  // #region Public Accessors (3)

  public get filesystem() {
    return this.params.accessor.filesystem;
  }

  public get fullPath() {
    return this.params.fullPath;
  }

  public get name() {
    return this.params.name;
  }

  // #endregion Public Accessors (3)

  // #region Public Methods (3)

  public getMetadata(
    successCallback: MetadataCallback,
    errorCallback?: ErrorCallback
  ): void {
    successCallback({
      modificationTime:
        this.params.lastModified == null
          ? null
          : new Date(this.params.lastModified),
      size: this.params.size,
    });
  }

  public getParent(
    successCallback: DirectoryEntryCallback,
    errorCallback?: ErrorCallback | undefined
  ): void {
    const parentPath = getParentPath(this.fullPath);
    const obj = createFileSystemObject(parentPath, false);
    successCallback(this.toDirectoryEntry(obj));
  }

  public toURL(): string {
    return this.params.url;
  }

  // #endregion Public Methods (3)

  // #region Public Abstract Methods (3)

  public abstract copyTo(
    parent: DirectoryEntry,
    newName?: string | undefined,
    successCallback?: EntryCallback | undefined,
    errorCallback?: ErrorCallback | undefined
  ): void;
  public abstract moveTo(
    parent: DirectoryEntry,
    newName?: string | undefined,
    successCallback?: EntryCallback | undefined,
    errorCallback?: ErrorCallback | undefined
  ): void;
  public abstract remove(
    successCallback: VoidCallback,
    errorCallback?: ErrorCallback | undefined
  ): void;

  // #endregion Public Abstract Methods (3)

  // #region Protected Methods (2)

  protected canCopy(
    parent: DirectoryEntry,
    newName?: string | undefined,
    errorCallback?: ErrorCallback | undefined
  ) {
    const fullPath = parent.fullPath + DIR_SEPARATOR + (newName || this.name);
    if (this.fullPath === fullPath) {
      onError(
        new InvalidModificationError(
          this.filesystem.name,
          this.fullPath,
          "A entry can't be copied into itself"
        ),
        errorCallback
      );
      return false;
    }
    return true;
  }

  // #endregion Protected Methods (2)

  // #region Protected Abstract Methods (1)

  protected abstract toDirectoryEntry(obj: FileSystemObject): DirectoryEntry;

  // #endregion Protected Abstract Methods (1)
}
