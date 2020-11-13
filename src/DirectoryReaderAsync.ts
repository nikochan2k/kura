import { EntryAsync } from "./EntryAsync";
import { DirectoryReader, Entry } from "./filesystem";
import { FileSystemAsync } from "./FileSystemAsync";
import { createEntry } from "./FileSystemUtil";

export class DirectoryReaderAsync {
  // #region Constructors (1)

  constructor(
    private fileSystemAsync: FileSystemAsync,
    private directoryReader: DirectoryReader
  ) {}

  // #endregion Constructors (1)

  // #region Public Methods (1)

  public readEntries(): Promise<EntryAsync<Entry>[]> {
    return new Promise<EntryAsync<Entry>[]>((resolve, reject) => {
      this.directoryReader.readEntries(
        (entries) => {
          resolve(
            entries.map((entry) => createEntry(this.fileSystemAsync, entry))
          );
        },
        (err) => {
          reject(err);
        }
      );
    });
  }

  // #endregion Public Methods (1)
}
