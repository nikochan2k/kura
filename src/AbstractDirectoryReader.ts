import { AbstractAccessor } from "./AbstractAccessor";
import { AbstractDirectoryEntry } from "./AbstractDirectoryEntry";
import { AbstractEntry } from "./AbstractEntry";
import { DirectoryReader, EntriesCallback, ErrorCallback } from "./filesystem";
import { FileSystemObject } from "./FileSystemObject";
import { INDEX_FILE_NAME } from "./FileSystemConstants";
import { onError } from "./FileSystemUtil";

export abstract class AbstractDirectoryReader<T extends AbstractAccessor>
  implements DirectoryReader {
  constructor(public dirEntry: AbstractDirectoryEntry<T>) {}

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

  protected createEntries(objects: FileSystemObject[]) {
    const entries: AbstractEntry<T>[] = [];
    for (const obj of objects) {
      if (obj.name === INDEX_FILE_NAME) {
        continue;
      }
      entries.push(this.createEntry(obj));
    }
    return entries;
  }

  protected abstract createEntry(obj: FileSystemObject): AbstractEntry<T>;
}
