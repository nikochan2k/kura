import { DirectoryReader, EntriesCallback, ErrorCallback } from "../filesystem";
import { FileSystemObject } from "../FileSystemObject";
import { IdbDirectoryEntry } from "./IdbDirectoryEntry";
import { IdbFileEntry } from "./IdbFileEntry";
import { onError } from "../FileSystemUtil";

export class IdbDirectoryReader implements DirectoryReader {
  constructor(public dirEntry: IdbDirectoryEntry) {}

  createEntry(obj: FileSystemObject) {
    return obj.size != null
      ? new IdbFileEntry({
          accessor: this.dirEntry.params.accessor,
          ...obj
        })
      : new IdbDirectoryEntry({
          accessor: this.dirEntry.params.accessor,
          ...obj
        });
  }

  createEntries(objects: FileSystemObject[]) {
    return objects.map(obj => {
      return this.createEntry(obj);
    });
  }

  readEntries(
    successCallback: EntriesCallback,
    errorCallback?: ErrorCallback
  ): void {
    this.dirEntry.params.accessor
      .getObjects(this.dirEntry.params.fullPath)
      .then(objects => {
        successCallback(this.createEntries(objects));
      })
      .catch(err => {
        onError(err, errorCallback);
      });
  }
}
