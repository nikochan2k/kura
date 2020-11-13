import { AbstractAccessor } from "./AbstractAccessor";
import { AbstractDirectoryEntry } from "./AbstractDirectoryEntry";
import { DirectoryReader, EntriesCallback, ErrorCallback } from "./filesystem";

export class DefaultDirectoryReader<T extends AbstractAccessor>
  implements DirectoryReader {
  // #region Constructors (1)

  constructor(public dirEntry: AbstractDirectoryEntry<T>) {}

  // #endregion Constructors (1)

  // #region Public Methods (1)

  public readEntries(
    successCallback: EntriesCallback,
    errorCallback?: ErrorCallback
  ): void {
    this.dirEntry.list(successCallback, errorCallback);
  }

  // #endregion Public Methods (1)
}
