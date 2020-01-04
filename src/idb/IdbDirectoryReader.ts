import { DirectoryReader, EntriesCallback, ErrorCallback } from "../filesystem";
import { IdbDirectoryEntry } from "./IdbDirectoryEntry";
import { onError } from "../FileSystemUtil";

export class IdbDirectoryReader implements DirectoryReader {
  constructor(public dirEntry: IdbDirectoryEntry) {}

  readEntries(
    successCallback: EntriesCallback,
    errorCallback?: ErrorCallback
  ): void {
    this.dirEntry.filesystem.idb
      .getEntries(this.dirEntry.fullPath, false)
      .then(entries => {
        successCallback(entries);
      })
      .catch(err => {
        onError(err, errorCallback);
      });
  }
}
