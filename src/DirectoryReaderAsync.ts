import { createEntry } from "./FileSystemUtil";
import { DirectoryEntry, DirectoryReader, FileEntry } from "./filesystem";
import { EntryAsync } from "./EntryAsync";
import { FileSystemAsync } from "./FileSystemAsync";

export class DirectoryReaderAsync {
  constructor(
    private fileSystemAsync: FileSystemAsync,
    private directoryReader: DirectoryReader
  ) {}

  readEntries(): Promise<EntryAsync<FileEntry | DirectoryEntry>[]> {
    return new Promise<EntryAsync<FileEntry | DirectoryEntry>[]>(
      (resolve, reject) => {
        this.directoryReader.readEntries(
          entries => {
            resolve(
              entries.map(entry => createEntry(this.fileSystemAsync, entry))
            );
          },
          error => {
            reject(error);
          }
        );
      }
    );
  }
}
