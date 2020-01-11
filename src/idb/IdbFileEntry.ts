import { AbstractFileEntry } from "../AbstractFileEntry";
import { base64ToFile, blobToFile, onError } from "../FileSystemUtil";
import { DIR_SEPARATOR } from "../FileSystemConstants";
import {
  DirectoryEntry,
  ErrorCallback,
  FileCallback,
  FileWriterCallback
} from "../filesystem";
import { FileSystemObject } from "../FileSystemObject";
import { FileSystemParams } from "../FileSystemParams";
import { IdbAccessor } from "./IdbAccessor";
import { IdbDirectoryEntry } from "./IdbDirectoryEntry";
import { IdbFileSystem } from "./IdbFileSystem";
import { IdbFileWriter } from "./IdbFileWriter";

export class IdbFileEntry extends AbstractFileEntry<IdbFileSystem> {
  private idbFileWriter: IdbFileWriter;

  constructor(params: FileSystemParams<IdbFileSystem>) {
    super(params);
  }

  createWriter(
    successCallback: FileWriterCallback,
    errorCallback?: ErrorCallback | undefined
  ): void {
    if (!this.idbFileWriter) {
      this.file(() => {
        successCallback(this.idbFileWriter);
      }, errorCallback);
    } else {
      successCallback(this.idbFileWriter);
    }
  }

  async delete() {
    await this.filesystem.accessor.delete(this.fullPath);
  }

  file(
    successCallback: FileCallback,
    errorCallback?: ErrorCallback | undefined
  ): void {
    if (this.idbFileWriter) {
      successCallback(this.idbFileWriter.file);
      return;
    }
    if (this.size === 0) {
      const file = blobToFile([], this.name, this.params.lastModified);
      this.idbFileWriter = new IdbFileWriter(this, file);
      successCallback(file);
      return;
    }
    const accessor = this.filesystem.accessor;
    accessor
      .getObject(this.fullPath)
      .then(entry => {
        accessor
          .getContent(this.fullPath)
          .then(content => {
            const file = IdbAccessor.SUPPORTS_BLOB
              ? blobToFile([content as Blob], entry.name, entry.lastModified)
              : base64ToFile(content as string, entry.name, entry.lastModified);
            this.idbFileWriter = new IdbFileWriter(this, file);
            successCallback(file);
          })
          .catch(error => {
            onError(error, errorCallback);
          });
      })
      .catch(error => {
        onError(error, errorCallback);
      });
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
}
