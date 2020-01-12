import { AbstractAccessor } from "./AbstractAccessor";
import { AbstractEntry } from "./AbstractEntry";
import { AbstractFileWriter } from "./AbstractFileWriter";
import { CONTENT_TYPE } from "./FileSystemConstants";
import { createEmptyFile, onError } from "./FileSystemUtil";
import {
  ErrorCallback,
  FileCallback,
  FileEntry,
  FileWriterCallback,
  VoidCallback
} from "./filesystem";
import { FileSystemParams } from "./FileSystemParams";

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
    if (this.size === 0) {
      const file = createEmptyFile(this.params.name);
      this.fileWriter = this.createFileWriter(file);
      successCallback(file);
      return;
    }
    const accessor = this.params.accessor;
    accessor
      .getContent(this.fullPath)
      .then(blob => {
        const file = new File([blob], this.params.name, {
          type: CONTENT_TYPE
        });
        this.fileWriter = this.createFileWriter(file);
        successCallback(file);
      })
      .catch(error => {
        onError(error, errorCallback);
      });
  }

  remove(
    successCallback: VoidCallback,
    errorCallback?: ErrorCallback | undefined
  ): void {
    this.params.accessor
      .delete(this.fullPath)
      .then(() => {
        successCallback();
      })
      .catch(err => {
        onError(err, errorCallback);
      });
  }

  protected abstract createFileWriter(file: File): AbstractFileWriter<T>;
}
