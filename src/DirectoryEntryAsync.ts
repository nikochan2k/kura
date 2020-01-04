import { DirectoryEntry, Flags } from "./filesystem";
import { DirectoryReaderAsync } from "./DirectoryReaderAsync";
import { EntryAsync } from "./EntryAsync";
import { FileEntryAsync } from "./FileEntryAsync";
import { FileSystemAsync } from "./FileSystemAsync";

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

  getFile(path: string, options?: Flags): Promise<FileEntryAsync> {
    return new Promise<FileEntryAsync>((resolve, reject) => {
      this.entry.getFile(
        path,
        options,
        entry => {
          resolve(new FileEntryAsync(this.fileSystemAsync, entry));
        },
        error => {
          reject(error);
        }
      );
    });
  }

  getDirectory(path: string, options?: Flags): Promise<DirectoryEntryAsync> {
    return new Promise<DirectoryEntryAsync>((resolve, reject) => {
      this.entry.getDirectory(
        path,
        options,
        entry => {
          resolve(new DirectoryEntryAsync(this.fileSystemAsync, entry));
        },
        error => {
          reject(error);
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
        error => {
          reject(error);
        }
      );
    });
  }
}
