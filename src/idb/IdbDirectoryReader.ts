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
          filesystem: this.dirEntry.filesystem,
          ...obj
        })
      : new IdbDirectoryEntry({
          filesystem: this.dirEntry.filesystem,
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
    const dirEntry = this.dirEntry;
    dirEntry.filesystem.accessor
      .getObjects(dirEntry.fullPath)
      .then(objects => {
        successCallback(this.createEntries(objects));
      })
      .catch(err => {
        onError(err, errorCallback);
      });
  }
}
