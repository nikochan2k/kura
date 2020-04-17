import { AbstractAccessor } from "./AbstractAccessor";
import { AbstractDirectoryEntry } from "./AbstractDirectoryEntry";
import { DirectoryReader, EntriesCallback, ErrorCallback } from "./filesystem";

export class DefaultDirectoryReader<T extends AbstractAccessor>
  implements DirectoryReader {
  constructor(public dirEntry: AbstractDirectoryEntry<T>) {}

  readEntries(
    successCallback: EntriesCallback,
    errorCallback?: ErrorCallback
  ): void {
    this.dirEntry.list(successCallback, errorCallback);
  }
}
