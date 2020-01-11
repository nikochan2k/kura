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
import { IdbAccessor } from "./IdbAccessor";
import { IdbDirectoryReader } from "./IdbDirectoryReader";
import { IdbFileEntry } from "./IdbFileEntry";
import { InvalidModificationError } from "../FileError";
import { onError } from "../FileSystemUtil";

export class IdbDirectoryEntry extends AbstractDirectoryEntry<IdbAccessor> {
  constructor(params: FileSystemParams<IdbAccessor>) {
    super(params);
  }

  toFileEntry(obj: FileSystemObject): FileEntry {
    return new IdbFileEntry({
      accessor: this.params.accessor,
      ...obj
    });
  }

  getDirectoryObject(path: string): Promise<FileSystemObject> {
    return this.params.accessor.getObject(path);
  }

  getFileObject(path: string): Promise<FileSystemObject> {
    return this.params.accessor.getObject(path);
  }

  createReader(): DirectoryReader {
    return new IdbDirectoryReader(this);
  }

  toDirectoryEntry(obj: FileSystemObject): DirectoryEntry {
    return new IdbDirectoryEntry({
      accessor: this.params.accessor,
      ...obj
    });
  }
  toURL(): string {
    return `idb:${location.protocol}:${location.host}:${location.port}${DIR_SEPARATOR}${this.params.fullPath}`;
  }

  async delete() {
    const accessor = this.params.accessor;
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
    return this.params.accessor.hasChild(this.fullPath);
  }

  async registerObject(path: string, isFile: boolean) {
    const obj = this.createObject(path, isFile);
    const accessor = this.params.accessor;
    await accessor.putObject(obj);
    return obj;
  }

  removeRecursively(
    successCallback: VoidCallback,
    errorCallback?: ErrorCallback | undefined
  ): void {
    this.params.accessor
      .deleteRecursively(this.fullPath)
      .then(() => {
        successCallback();
      })
      .catch(err => {
        onError(err, errorCallback);
      });
  }
}
