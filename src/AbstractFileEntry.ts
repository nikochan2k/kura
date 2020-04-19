import { AbstractAccessor } from "./AbstractAccessor";
import { AbstractEntry } from "./AbstractEntry";
import { AbstractFileWriter } from "./AbstractFileWriter";
import {
  ContentCallback,
  DataType,
  DirectoryEntry,
  EntryCallback,
  ErrorCallback,
  FileCallback,
  FileEntry,
  FileWriterCallback,
  TextCallback,
  VoidCallback,
} from "./filesystem";
import { DEFAULT_CONTENT_TYPE } from "./FileSystemConstants";
import { FileSystemObject } from "./FileSystemObject";
import { FileSystemParams } from "./FileSystemParams";
import { getSize, getTextSize, onError } from "./FileSystemUtil";
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
        const file = new File([blob], this.params.name, {
          type: DEFAULT_CONTENT_TYPE,
          lastModified: this.params.lastModified,
        });
        this.fileWriter = this.createFileWriter(file);
        successCallback(file);
      })
      .catch((err) => {
        onError(err, errorCallback);
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

  readFile(
    successCallback: ContentCallback,
    errorCallback?: ErrorCallback,
    type?: DataType
  ): void {
    this.params.accessor
      .getContent(this.fullPath, type)
      .then((content) => {
        successCallback(content);
      })
      .catch((err) => {
        onError(err, errorCallback);
      });
  }

  readText(successCallback: TextCallback, errorCallback?: ErrorCallback): void {
    this.params.accessor
      .getText(this.fullPath)
      .then((text) => {
        successCallback(text);
      })
      .catch((err) => {
        onError(err, errorCallback);
      });
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

  writeFile(
    content: Blob | Uint8Array | ArrayBuffer | string,
    successCallback?: VoidCallback,
    errorCallback?: ErrorCallback
  ): void {
    this.params.accessor
      .putContent(this.fullPath, content)
      .then(() => {
        const obj: FileSystemObject = {
          name: this.name,
          fullPath: this.fullPath,
          lastModified: Date.now(),
          size: getSize(content),
        };
        this.params.accessor
          .putObject(obj)
          .then(() => {
            this.params.size = obj.size;
            successCallback();
          })
          .catch((err) => {
            onError(err, errorCallback);
          });
      })
      .catch((err) => {
        onError(err, errorCallback);
      });
  }

  writeText(
    text: string,
    successCallback?: VoidCallback,
    errorCallback?: ErrorCallback
  ): void {
    this.params.accessor
      .putText(this.fullPath, text)
      .then(() => {
        const obj: FileSystemObject = {
          name: this.name,
          fullPath: this.fullPath,
          lastModified: Date.now(),
          size: getTextSize(text),
        };
        this.params.accessor
          .putObject(obj)
          .then(() => {
            this.params.size = obj.size;
            successCallback();
          })
          .catch((err) => {
            onError(err, errorCallback);
          });
      })
      .catch((err) => {
        onError(err, errorCallback);
      });
  }

  protected abstract createFileWriter(file: File): AbstractFileWriter<T>;
}
