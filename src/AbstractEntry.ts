import { AbstractAccessor } from "./AbstractAccessor";
import { DIR_SEPARATOR } from "./FileSystemConstants";
import {
  DirectoryEntry,
  DirectoryEntryCallback,
  Entry,
  EntryCallback,
  ErrorCallback,
  MetadataCallback,
  VoidCallback
} from "./filesystem";
import { FileSystemObject } from "./FileSystemObject";
import { FileSystemParams } from "./FileSystemParams";
import { getParentPath } from "./FileSystemUtil";
import { NotImplementedError } from "./FileError";

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

  copyTo(
    parent: DirectoryEntry,
    newName?: string | undefined,
    successCallback?: EntryCallback | undefined,
    errorCallback?: ErrorCallback | undefined
  ): void {
    throw new NotImplementedError(this.filesystem.name, this.fullPath);
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
      size: this.params.size
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

  moveTo(
    parent: DirectoryEntry,
    newName?: string | undefined,
    successCallback?: EntryCallback | undefined,
    errorCallback?: ErrorCallback | undefined
  ): void {
    throw new NotImplementedError(this.filesystem.name, this.fullPath);
  }

  toURL(): string {
    throw new NotImplementedError(this.filesystem.name, this.fullPath);
  }

  abstract remove(
    successCallback: VoidCallback,
    errorCallback?: ErrorCallback | undefined
  ): void;

  protected createObject(path: string, isFile: boolean): FileSystemObject {
    return {
      name: path.split(DIR_SEPARATOR).pop(),
      fullPath: path,
      lastModified: isFile ? Date.now() : undefined,
      size: isFile ? 0 : undefined
    };
  }

  protected abstract toDirectoryEntry(obj: FileSystemObject): DirectoryEntry;
}
