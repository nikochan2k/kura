import { AbstractFileEntry } from "../AbstractFileEntry";
import { base64ToFile, blobToFile, onError } from "../FileSystemUtil";
import { ErrorCallback, FileCallback, FileWriterCallback } from "../filesystem";
import { FileSystemParams } from "../FileSystemParams";
import { Idb } from "./Idb";
import { IdbEntrySupport } from "./IdbEntrySupport";
import { IdbFileSystem } from "./IdbFileSystem";
import { IdbFileWriter } from "./IdbFileWriter";

export class IdbFileEntry extends AbstractFileEntry<IdbFileSystem> {
  private idbFileWriter: IdbFileWriter;

  isDirectory = false;
  isFile = true;

  constructor(params: FileSystemParams<IdbFileSystem>) {
    super(params, new IdbEntrySupport(params));
  }

  createWriter(
    successCallback: FileWriterCallback,
    errorCallback?: ErrorCallback | undefined
  ): void {
    if (!this.idbFileWriter) {
      this.file(file => {
        successCallback(this.idbFileWriter);
      }, errorCallback);
    } else {
      successCallback(this.idbFileWriter);
    }
  }

  async delete() {
    await this.filesystem.idb.delete(this.fullPath);
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
    const idb = this.filesystem.idb;
    idb
      .getEntry(this.fullPath)
      .then(entry => {
        idb
          .getContent(this.fullPath)
          .then(content => {
            const file = Idb.SUPPORTS_BLOB
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
}
