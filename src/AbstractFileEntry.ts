import { AbstractAccessor } from "./AbstractAccessor";
import { AbstractEntry } from "./AbstractEntry";
import { AbstractFileWriter } from "./AbstractFileWriter";
import {
  DirectoryEntry,
  EntryCallback,
  ErrorCallback,
  FileCallback,
  FileEntry,
  FileWriterCallback,
  VoidCallback,
  ContentCallback,
} from "./filesystem";
import { CONTENT_TYPE } from "./FileSystemConstants";
import { FileSystemParams } from "./FileSystemParams";
import { onError } from "./FileSystemUtil";
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
      (fileEntry) => {
        fileEntry.createWriter((writer) => {
          this.file((file) => {
            const writerAsync = new FileWriterAsync(writer);
            writerAsync
              .write(file)
              .then(() => {
                if (successCallback) {
                  successCallback(fileEntry);
                }
              })
              .catch((err) => onError(err, errorCallback));
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
      .getContent(this.fullPath, "blob")
      .then(async (blob) => {
        if (!blob) {
          successCallback(null);
          return;
        }
        const size = this.params.accessor.getSize(blob);
        if (this.size !== size) {
          await this.params.accessor.resetSize(this.fullPath, size);
        }
        const file = new File([blob], this.params.name, {
          type: CONTENT_TYPE,
          lastModified: this.params.lastModified,
        });
        this.fileWriter = this.createFileWriter(file);
        successCallback(file);
      })
      .catch((error) => {
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
      (fileEntry) => {
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
      .catch((err) => {
        onError(err, errorCallback);
      });
  }

  readContent(
    type: "blob" | "arrayBuffer" | "base64" | "utf8",
    successCallback: ContentCallback,
    errorCallback?: ErrorCallback
  ): void {
    this.params.accessor
      .getContent(this.fullPath, type)
      .then((content) => {
        successCallback(content);
      })
      .catch((err) => {
        onError(errorCallback, err);
      });
  }

  writeContent(
    content: Blob | ArrayBuffer | string,
    stringType?: "base64" | "utf8",
    successCallback?: VoidCallback,
    errorCallback?: ErrorCallback
  ): void {
    this.params.accessor
      .putContent(this.fullPath, content, stringType)
      .then(() => {
        successCallback();
      })
      .catch((err) => {
        onError(errorCallback, err);
      });
  }

  protected abstract createFileWriter(file: File): AbstractFileWriter<T>;
}
