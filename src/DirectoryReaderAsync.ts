import { EntryAsync } from "./EntryAsync";
import { DirectoryReader, Entry } from "./filesystem";
import { FileSystemAsync } from "./FileSystemAsync";
import { createEntry } from "./FileSystemUtil";

export class DirectoryReaderAsync {
  constructor(
    private fileSystemAsync: FileSystemAsync,
    private directoryReader: DirectoryReader
  ) {}

  readEntries(): Promise<EntryAsync<Entry>[]> {
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
}
