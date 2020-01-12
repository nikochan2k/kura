import { AbstractAccessor } from "./AbstractAccessor";
import { AbstractDirectoryEntry } from "./AbstractDirectoryEntry";
import { AbstractEntry } from "./AbstractEntry";
import { DirectoryReader, EntriesCallback, ErrorCallback } from "./filesystem";
import { FileSystemObject } from "./FileSystemObject";
import { onError } from "./FileSystemUtil";

export abstract class AbstractDirectoryReader<T extends AbstractAccessor>
  implements DirectoryReader {
  constructor(public dirEntry: AbstractDirectoryEntry<T>) {}

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

  abstract createEntry(obj: FileSystemObject): AbstractEntry<T>;
}
