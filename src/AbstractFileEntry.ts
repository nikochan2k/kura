import { AbstractAccessor } from "./AbstractAccessor";
import { AbstractEntry } from "./AbstractEntry";
import {
  ErrorCallback,
  FileCallback,
  FileEntry,
  FileWriterCallback,
  VoidCallback
} from "./filesystem";
import { FileSystemParams } from "./FileSystemParams";
import { onError } from "./FileSystemUtil";

export abstract class AbstractFileEntry<T extends AbstractAccessor>
  extends AbstractEntry<T>
  implements FileEntry {
  isDirectory = false;
  isFile = true;
  size: number;

  constructor(params: FileSystemParams<T>) {
    super(params);
  }

  remove(
    successCallback: VoidCallback,
    errorCallback?: ErrorCallback | undefined
  ): void {
    this.delete()
      .then(() => {
        successCallback();
      })
      .catch(err => {
        onError(err, errorCallback);
      });
  }

  abstract createWriter(
    successCallback: FileWriterCallback,
    errorCallback?: ErrorCallback
  ): void;

  abstract file(
    successCallback: FileCallback,
    errorCallback?: ErrorCallback
  ): void;
}
