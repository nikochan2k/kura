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
import { FileSystemParams } from "./FileSystemParams";
import { onError } from "./FileSystemUtil";

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

    this.readFile((content) => {
      parent.getFile(newName || this.name, { create: true }, (fileEntry) => {
        fileEntry.writeFile(
          content,
          () => {
            successCallback(fileEntry);
          },
          errorCallback
        );
      });
    }, errorCallback);
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
      .readContent(this.params, "blob")
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
      .readContent(this.params, type)
      .then((content) => {
        successCallback(content);
      })
      .catch((err) => {
        onError(err, errorCallback);
      });
  }

  readText(successCallback: TextCallback, errorCallback?: ErrorCallback): void {
    this.params.accessor
      .readText(this.params)
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
      .putObject(this.params, content)
      .then((obj) => {
        this.params.size = obj.size;
        successCallback();
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
      .putText(this.params, text)
      .then((obj) => {
        this.params.size = obj.size;
        successCallback();
      })
      .catch((err) => {
        onError(err, errorCallback);
      });
  }

  protected abstract createFileWriter(file: File): AbstractFileWriter<T>;
}
