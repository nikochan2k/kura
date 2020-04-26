import { DirectoryReaderAsync } from "./DirectoryReaderAsync";
import { EntryAsync } from "./EntryAsync";
import { FileEntryAsync } from "./FileEntryAsync";
import { NotFoundError } from "./FileError";
import { DirectoryEntry, Entry, Flags } from "./filesystem";
import { FileSystemAsync } from "./FileSystemAsync";
import { createEntry } from "./FileSystemUtil";

export class DirectoryEntryAsync extends EntryAsync<DirectoryEntry> {
  constructor(
    fileSystemAsync: FileSystemAsync,
    directoryEntry: DirectoryEntry
  ) {
    super(fileSystemAsync, directoryEntry);
  }

  createReader(): DirectoryReaderAsync {
    return new DirectoryReaderAsync(
      this.fileSystemAsync,
      this.entry.createReader()
    );
  }

  getDirectory(path: string, options?: Flags): Promise<DirectoryEntryAsync> {
    return new Promise<DirectoryEntryAsync>((resolve, reject) => {
      this.entry.getDirectory(
        path,
        options,
        (entry) => {
          resolve(new DirectoryEntryAsync(this.fileSystemAsync, entry));
        },
        (err) => {
          if (err instanceof NotFoundError) {
            resolve(null);
            return;
          }
          reject(err);
        }
      );
    });
  }

  getFile(path: string, options?: Flags): Promise<FileEntryAsync> {
    return new Promise<FileEntryAsync>((resolve, reject) => {
      this.entry.getFile(
        path,
        options,
        (entry) => {
          resolve(new FileEntryAsync(this.fileSystemAsync, entry));
        },
        (err) => {
          if (err instanceof NotFoundError) {
            resolve(null);
            return;
          }
          reject(err);
        }
      );
    });
  }

  list(): Promise<EntryAsync<Entry>[]> {
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

  removeRecursively(): Promise<void> {
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
}
