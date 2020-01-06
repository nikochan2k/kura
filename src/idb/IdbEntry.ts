import { DIR_SEPARATOR } from "../FileSystemConstants";
import {
  DirectoryEntry,
  DirectoryEntryCallback,
  Entry,
  EntryCallback,
  ErrorCallback,
  Metadata,
  MetadataCallback,
  VoidCallback
} from "../filesystem";
import { FileSystemObject } from "../FileSystemObject";
import { FileSystemParams } from "../FileSystemParams";
import { getName, getParentPath } from "../FileSystemUtil";
import { IdbDirectoryEntry } from "./IdbDirectoryEntry";
import { IdbFileSystem } from "./IdbFileSystem";
import { NotImplementedError } from "../FileError";

export abstract class IdbEntry implements Entry {
  abstract isDirectory: boolean;
  abstract isFile: boolean;

  constructor(public params: FileSystemParams<IdbFileSystem>) {}

  get filesystem() {
    return this.params.filesystem;
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
    successCallback(
      new IdbDirectoryEntry({
        filesystem: this.filesystem,
        name: getName(parentPath),
        fullPath: parentPath
      })
    );
  }

  moveTo(
    parent: DirectoryEntry,
    newName?: string | undefined,
    successCallback?: EntryCallback | undefined,
    errorCallback?: ErrorCallback | undefined
  ): void {
    throw new NotImplementedError(this.filesystem.name, this.fullPath);
  }

  setMetadata(
    metadata: Metadata,
    successCallback: VoidCallback,
    errorCallback?: ErrorCallback
  ): void {
    const temp = { ...metadata };
    delete temp["modificationTime"];
    delete temp["size"];
    const lastModified =
      metadata.modificationTime === undefined
        ? this.params.lastModified
        : metadata.modificationTime === null
        ? null
        : metadata.modificationTime.getTime();
    const obj: FileSystemObject = {
      ...temp,
      name: this.name,
      fullPath: this.fullPath,
      lastModified: lastModified,
      size: this.params.size
    };
    this.filesystem.idb
      .putEntry(obj)
      .then(() => {
        this.params.lastModified = lastModified;
        successCallback();
      })
      .catch(err => {
        errorCallback(err);
      });
  }

  toURL(): string {
    return `filesystem:${location.protocol}:${location.host}:${location.port}${DIR_SEPARATOR}${this.fullPath}`;
  }

  abstract remove(
    successCallback: VoidCallback,
    errorCallback?: ErrorCallback | undefined
  ): void;
}
