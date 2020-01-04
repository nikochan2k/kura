import { base64ToFile, blobToFile, onError } from "../FileSystemUtil";
import {
  ErrorCallback,
  FileCallback,
  FileEntry,
  FileWriterCallback,
  VoidCallback
} from "../filesystem";
import { FileSystemParams } from "../FileSystemParams";
import { Idb } from "./Idb";
import { IdbEntry } from "./IdbEntry";
import { IdbFileSystem } from "./IdbFileSystem";
import { IdbFileWriter } from "./IdbFileWriter";

export class IdbFileEntry extends IdbEntry implements FileEntry {
  isFile = true;
  isDirectory = false;
  get size() {
    return this.params.size;
  }
  private idbFileWriter: IdbFileWriter;

  constructor(params: FileSystemParams<IdbFileSystem>) {
    super(params);
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

  remove(
    successCallback: VoidCallback,
    errorCallback?: ErrorCallback | undefined
  ): void {
    const idb = this.filesystem.idb;
    idb
      .delete(this.fullPath)
      .then(() => {
        successCallback();
      })
      .catch(err => {
        onError(err, errorCallback);
      });
  }
}
