import { AbstractLocalFileSystem } from "../AbstractLocalFileSystem";
import {
  EntryCallback,
  ErrorCallback,
  FileSystemCallback
} from "../filesystem";
import { Idb } from "./Idb";
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

    const idb = new Idb();
    idb
      .open(this.bucket)
      .then(() => {
        successCallback(idb.filesystem);
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
