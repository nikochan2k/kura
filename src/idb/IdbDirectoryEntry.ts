import { AbstractDirectoryEntry } from "../AbstractDirectoryEntry";
import { DIR_SEPARATOR } from "../FileSystemConstants";
import {
  DirectoryEntry,
  DirectoryReader,
  ErrorCallback,
  FileEntry,
  VoidCallback
} from "../filesystem";
import { FileSystemObject } from "../FileSystemObject";
import { FileSystemParams } from "../FileSystemParams";
import { IdbDirectoryReader } from "./IdbDirectoryReader";
import { IdbFileEntry } from "./IdbFileEntry";
import { IdbFileSystem } from "./IdbFileSystem";
import { InvalidModificationError } from "../FileError";
import { onError } from "../FileSystemUtil";

export class IdbDirectoryEntry extends AbstractDirectoryEntry<IdbFileSystem> {
  constructor(params: FileSystemParams<IdbFileSystem>) {
    super(params);
  }

  toFileEntry(obj: FileSystemObject): FileEntry {
    return new IdbFileEntry({
      filesystem: this.params.filesystem,
      ...obj
    });
  }

  getDirectoryObject(path: string): Promise<FileSystemObject> {
    return this.params.filesystem.accessor.getObject(path);
  }

  getFileObject(path: string): Promise<FileSystemObject> {
    return this.params.filesystem.accessor.getObject(path);
  }

  createReader(): DirectoryReader {
    return new IdbDirectoryReader(this);
  }

  toDirectoryEntry(obj: FileSystemObject): DirectoryEntry {
    return new IdbDirectoryEntry({
      filesystem: this.params.filesystem,
      ...obj
    });
  }
  toURL(): string {
    return `idb:${location.protocol}:${location.host}:${location.port}${DIR_SEPARATOR}${this.params.fullPath}`;
  }

  async delete() {
    const accessor = this.filesystem.accessor;
    if (await accessor.hasChild(this.fullPath)) {
      throw new InvalidModificationError(
        this.filesystem.name,
        this.fullPath,
        `${this.fullPath} is not empty`
      );
    }

    await accessor.delete(this.fullPath);
  }

  hasChild(): Promise<boolean> {
    return this.filesystem.accessor.hasChild(this.fullPath);
  }

  async registerObject(path: string, isFile: boolean) {
    const obj = this.createObject(path, isFile);
    const accessor = this.filesystem.accessor;
    await accessor.putObject(obj);
    return obj;
  }

  removeRecursively(
    successCallback: VoidCallback,
    errorCallback?: ErrorCallback | undefined
  ): void {
    this.filesystem.accessor
      .deleteRecursively(this.fullPath)
      .then(() => {
        successCallback();
      })
      .catch(err => {
        onError(err, errorCallback);
      });
  }
}
