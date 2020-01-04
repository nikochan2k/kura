import { EntryAsync } from "./EntryAsync";
import { FileEntry } from "./filesystem";
import { FileSystemAsync } from "./FileSystemAsync";
import { FileWriterAsync } from "./FileWriterAsync";

export class FileEntryAsync extends EntryAsync<FileEntry> {
  constructor(fileSystemAsync: FileSystemAsync, fileEntry: FileEntry) {
    super(fileSystemAsync, fileEntry);
  }

  createWriter(): Promise<FileWriterAsync> {
    return new Promise<FileWriterAsync>((resolve, reject) => {
      this.entry.createWriter(
        fileWriter => {
          resolve(new FileWriterAsync(fileWriter));
        },
        error => {
          reject(error);
        }
      );
    });
  }

  file(): Promise<File> {
    return new Promise((resolve, reject) => {
      this.entry.file(
        file => {
          resolve(file);
        },
        error => {
          reject(error);
        }
      );
    });
  }
}
