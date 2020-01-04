import { DirectoryEntry, FileEntry, LocalFileSystem } from "./filesystem";
import { EntryAsync } from "./EntryAsync";
import { FileSystemAsync } from "./FileSystemAsync";
import { NotImplementedError } from "./FileError";

export class LocalFileSystemAsync {
  constructor(public localFileSystem: LocalFileSystem) {}

  get TEMPORARY() {
    return window.TEMPORARY;
  }

  get PERSISTENT() {
    return window.PERSISTENT;
  }

  requestFileSystemAsync(type: number, size: number): Promise<FileSystemAsync> {
    return new Promise<FileSystemAsync>((resolve, reject) => {
      this.localFileSystem.requestFileSystem(
        type,
        size,
        filesystem => {
          resolve(new FileSystemAsync(filesystem));
        },
        err => {
          reject(err);
        }
      );
    });
  }

  resolveLocalFileSystemAsyncURL(
    url: string
  ): Promise<EntryAsync<FileEntry | DirectoryEntry>> {
    throw new NotImplementedError("", url);
  }
}
