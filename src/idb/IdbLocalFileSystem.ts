import { AbstractLocalFileSystem } from "../AbstractLocalFileSystem";
import {
  EntryCallback,
  ErrorCallback,
  FileSystemCallback
} from "../filesystem";
import { IdbAccessor } from "./IdbAccessor";
import { NotImplementedError } from "../FileError";
import { onError } from "../FileSystemUtil";

if (window.TEMPORARY == null) {
  window.TEMPORARY = 0;
}
if (window.PERSISTENT == null) {
  window.PERSISTENT = 1;
}

export class IdbLocalFileSystem extends AbstractLocalFileSystem {
  requestFileSystem(
    type: number,
    size: number,
    successCallback: FileSystemCallback,
    errorCallback?: ErrorCallback | undefined
  ): void {
    if (type === this.TEMPORARY) {
      throw new Error("No temporary storage");
    }

    const accessor = new IdbAccessor(this.useIndex);
    accessor
      .open(this.bucket)
      .then(() => {
        successCallback(accessor.filesystem);
      })
      .catch(err => {
        onError(err, errorCallback);
      });
  }

  resolveLocalFileSystemURL(
    url: string,
    successCallback: EntryCallback,
    errorCallback?: ErrorCallback | undefined
  ): void {
    throw new NotImplementedError("", url);
  }
}
