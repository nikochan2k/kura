import { DirectoryReaderAsync } from "./DirectoryReaderAsync";
import { EntryAsync } from "./EntryAsync";
import { FileEntryAsync } from "./FileEntryAsync";
import { DirectoryEntry, Entry, Flags } from "./filesystem";
import { FileSystemAsync } from "./FileSystemAsync";
import { createEntry } from "./FileSystemUtil";

export class DirectoryEntryAsync extends EntryAsync<DirectoryEntry> {
  // #region Constructors (1)

  constructor(
    fileSystemAsync: FileSystemAsync,
    directoryEntry: DirectoryEntry
  ) {
    super(fileSystemAsync, directoryEntry);
  }

  // #endregion Constructors (1)

  // #region Public Methods (5)

  public createReader(): DirectoryReaderAsync {
    return new DirectoryReaderAsync(
      this.fileSystemAsync,
      this.entry.createReader()
    );
  }

  public getDirectory(
    path: string,
    options?: Flags
  ): Promise<DirectoryEntryAsync> {
    return new Promise<DirectoryEntryAsync>((resolve, reject) => {
      this.entry.getDirectory(
        path,
        options,
        (entry) => {
          resolve(new DirectoryEntryAsync(this.fileSystemAsync, entry));
        },
        (err) => {
          reject(err);
        }
      );
    });
  }

  public getFile(path: string, options?: Flags): Promise<FileEntryAsync> {
    return new Promise<FileEntryAsync>((resolve, reject) => {
      this.entry.getFile(
        path,
        options,
        (entry) => {
          resolve(new FileEntryAsync(this.fileSystemAsync, entry));
        },
        (err) => {
          reject(err);
        }
      );
    });
  }

  public list(): Promise<EntryAsync<Entry>[]> {
    return new Promise<EntryAsync<Entry>[]>((resolve, reject) => {
      this.entry.list(
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

  public removeRecursively(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.entry.removeRecursively(
        () => {
          resolve();
        },
        (err) => {
          reject(err);
        }
      );
    });
  }

  // #endregion Public Methods (5)
}
