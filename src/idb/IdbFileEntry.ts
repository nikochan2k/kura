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
import { IdbFileWriter } from "./IdbFileWriter";

export class IdbFileEntry extends AbstractFileEntry<IdbAccessor> {
  private idbFileWriter: IdbFileWriter;

  constructor(params: FileSystemParams<IdbAccessor>) {
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
    await this.params.accessor.delete(this.fullPath);
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
    const accessor = this.params.accessor;
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
      accessor: this.params.accessor,
      ...obj
    });
  }

  toURL(): string {
    return `idb:${location.protocol}:${location.host}:${location.port}${DIR_SEPARATOR}${this.params.fullPath}`;
  }
}
