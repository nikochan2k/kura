import { AbstractAccessor } from "./AbstractAccessor";
import { AbstractEntry } from "./AbstractEntry";
import { AbstractFileWriter } from "./AbstractFileWriter";
import { CONTENT_TYPE } from "./FileSystemConstants";
import { createEmptyFile, onError } from "./FileSystemUtil";
import {
  DirectoryEntry,
  EntryCallback,
  ErrorCallback,
  FileCallback,
  FileEntry,
  FileWriterCallback,
  VoidCallback
} from "./filesystem";
import { FileSystemParams } from "./FileSystemParams";
import { FileWriterAsync } from "./FileWriterAsync";

export abstract class AbstractFileEntry<T extends AbstractAccessor>
  extends AbstractEntry<T>
  implements FileEntry {
  fileWriter: AbstractFileWriter<T>;
  isDirectory = false;
  isFile = true;

  constructor(params: FileSystemParams<T>) {
    super(params);
  }

  get size() {
    return this.params.size;
  }

  copyTo(
    parent: DirectoryEntry,
    newName?: string | undefined,
    successCallback?: EntryCallback | undefined,
    errorCallback?: ErrorCallback | undefined
  ): void {
    if (!this.canCopy(parent, newName, errorCallback)) {
      return;
    }

    parent.getFile(
      newName || this.name,
      { create: true, exclusive: true },
      fileEntry => {
        fileEntry.createWriter(writer => {
          this.file(file => {
            const writerAsync = new FileWriterAsync(writer);
            writerAsync
              .write(file)
              .then(() => {
                if (successCallback) {
                  successCallback(fileEntry);
                }
              })
              .catch(err => onError(err, errorCallback));
          }, errorCallback);
        }, errorCallback);
      },
      errorCallback
    );
  }

  createWriter(
    successCallback: FileWriterCallback,
    errorCallback?: ErrorCallback | undefined
  ): void {
    if (!this.fileWriter) {
      this.file(() => {
        successCallback(this.fileWriter);
      }, errorCallback);
    } else {
      successCallback(this.fileWriter);
    }
  }

  file(
    successCallback: FileCallback,
    errorCallback?: ErrorCallback | undefined
  ): void {
    if (this.fileWriter) {
      successCallback(this.fileWriter.file);
      return;
    }
    const accessor = this.params.accessor;
    accessor
      .getContent(this.fullPath)
      .then(async blob => {
        if (this.size !== blob.size) {
          await this.params.accessor.resetObject(this.fullPath, blob.size);
        }
        const file = new File([blob], this.params.name, {
          type: CONTENT_TYPE,
          lastModified: this.params.lastModified
        });
        this.fileWriter = this.createFileWriter(file);
        successCallback(file);
      })
      .catch(error => {
        onError(error, errorCallback);
      });
  }

  moveTo(
    parent: DirectoryEntry,
    newName?: string | undefined,
    successCallback?: EntryCallback | undefined,
    errorCallback?: ErrorCallback | undefined
  ): void {
    this.copyTo(
      parent,
      newName,
      fileEntry => {
        this.remove(() => {
          if (successCallback) {
            successCallback(fileEntry);
          }
        }, errorCallback);
      },
      errorCallback
    );
  }

  remove(
    successCallback: VoidCallback,
    errorCallback?: ErrorCallback | undefined
  ): void {
    this.params.accessor
      .delete(this.fullPath, true)
      .then(() => {
        successCallback();
      })
      .catch(err => {
        onError(err, errorCallback);
      });
  }

  protected abstract createFileWriter(file: File): AbstractFileWriter<T>;
}
