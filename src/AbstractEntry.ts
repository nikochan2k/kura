import { AbstractAccessor } from "./AbstractAccessor";
import { DIR_SEPARATOR } from "./FileSystemConstants";
import {
  DirectoryEntry,
  DirectoryEntryCallback,
  Entry,
  EntryCallback,
  ErrorCallback,
  MetadataCallback,
  VoidCallback,
} from "./filesystem";
import { FileSystemObject } from "./FileSystemObject";
import { FileSystemParams } from "./FileSystemParams";
import { getParentPath, onError } from "./FileSystemUtil";
import { InvalidModificationError } from "./FileError";

export abstract class AbstractEntry<T extends AbstractAccessor>
  implements Entry {
  abstract isDirectory: boolean;
  abstract isFile: boolean;

  constructor(public params: FileSystemParams<T>) {}

  get filesystem() {
    return this.params.accessor.filesystem;
  }

  get fullPath() {
    return this.params.fullPath;
  }

  get name() {
    return this.params.name;
  }

  getMetadata(
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

  getParent(
    successCallback: DirectoryEntryCallback,
    errorCallback?: ErrorCallback | undefined
  ): void {
    const parentPath = getParentPath(this.fullPath);
    const obj = this.createObject(parentPath, false);
    successCallback(this.toDirectoryEntry(obj));
  }

  toURL(): string {
    return this.params.accessor.toURL(this.fullPath);
  }

  abstract copyTo(
    parent: DirectoryEntry,
    newName?: string | undefined,
    successCallback?: EntryCallback | undefined,
    errorCallback?: ErrorCallback | undefined
  ): void;
  abstract moveTo(
    parent: DirectoryEntry,
    newName?: string | undefined,
    successCallback?: EntryCallback | undefined,
    errorCallback?: ErrorCallback | undefined
  ): void;
  abstract remove(
    successCallback: VoidCallback,
    errorCallback?: ErrorCallback | undefined
  ): void;

  protected canCopy(
    parent: DirectoryEntry,
    newName?: string | undefined,
    errorCallback?: ErrorCallback | undefined
  ) {
    const fullPath = parent.fullPath + "/" + (newName || this.name);
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

  protected createObject(path: string, isFile: boolean): FileSystemObject {
    return {
      name: path.split(DIR_SEPARATOR).pop(),
      fullPath: path,
      lastModified: isFile ? Date.now() : undefined,
      size: isFile ? 0 : undefined,
    };
  }

  protected abstract toDirectoryEntry(obj: FileSystemObject): DirectoryEntry;
}
