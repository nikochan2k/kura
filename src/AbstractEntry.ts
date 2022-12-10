import { AbstractAccessor } from "./AbstractAccessor";
import { InvalidModificationError, NotReadableError } from "./FileError";
import {
  DirectoryEntry,
  DirectoryEntryCallback,
  Entry,
  EntryCallback,
  ErrorCallback,
  MetadataCallback,
  URLCallback,
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
  implements Entry
{
  public abstract isDirectory: boolean;
  public abstract isFile: boolean;

  constructor(public params: FileSystemParams<T>) {}

  public get filesystem() {
    return this.params.accessor.filesystem;
  }

  public get fullPath() {
    return this.params.fullPath;
  }

  public get name() {
    return this.params.name;
  }

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

  public toURL(
    urlCallback: URLCallback,
    errorCallback?: ErrorCallback,
    method?: "GET" | "POST" | "PUT" | "DELETE"
  ): void {
    this.params.accessor
      .getURL(this.fullPath, method)
      .then((url) => urlCallback(url))
      .catch((e) => {
        onError(
          new NotReadableError(this.name, this.fullPath, e),
          errorCallback
        );
      });
  }

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

  protected abstract toDirectoryEntry(obj: FileSystemObject): DirectoryEntry;
}
