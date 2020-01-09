import { AbstractDirectoryEntry } from "../AbstractDirectoryEntry";
import { DirectoryReader, ErrorCallback, VoidCallback } from "../filesystem";
import { FileSystemParams } from "../FileSystemParams";
import { IdbDirectoryReader } from "./IdbDirectoryReader";
import { IdbEntrySupport } from "./IdbEntrySupport";
import { IdbFileSystem } from "./IdbFileSystem";
import { InvalidModificationError } from "../FileError";
import { onError } from "../FileSystemUtil";

export class IdbDirectoryEntry extends AbstractDirectoryEntry<IdbFileSystem> {
  constructor(params: FileSystemParams<IdbFileSystem>) {
    super(params, new IdbEntrySupport(params));
  }

  createReader(): DirectoryReader {
    return new IdbDirectoryReader(this);
  }

  async delete() {
    const idb = this.filesystem.idb;
    if (await idb.hasChild(this.fullPath)) {
      throw new InvalidModificationError(
        this.filesystem.name,
        this.fullPath,
        `${this.fullPath} is not empty`
      );
    }

    await idb.delete(this.fullPath);
  }

  hasChild(): Promise<boolean> {
    return this.filesystem.idb.hasChild(this.fullPath);
  }

  async registerObject(path: string, isFile: boolean) {
    const obj = this.createObject(path, isFile);
    const idb = this.filesystem.idb;
    await idb.putEntry(obj);
    return obj;
  }

  removeRecursively(
    successCallback: VoidCallback,
    errorCallback?: ErrorCallback | undefined
  ): void {
    this.filesystem.idb
      .deleteRecursively(this.fullPath)
      .then(() => {
        successCallback();
      })
      .catch(err => {
        onError(err, errorCallback);
      });
  }
}
