import { EntryAsync } from "./EntryAsync";
import { NotImplementedError } from "./FileError";
import { Entry, LocalFileSystem } from "./filesystem";
import { FileSystemAsync } from "./FileSystemAsync";

export class LocalFileSystemAsync {
  constructor(public localFileSystem: LocalFileSystem) {}

  get PERSISTENT() {
    return this.localFileSystem.PERSISTENT;
  }

  get TEMPORARY() {
    return this.localFileSystem.TEMPORARY;
  }

  requestFileSystemAsync(type: number, size: number): Promise<FileSystemAsync> {
    return new Promise<FileSystemAsync>((resolve, reject) => {
      this.localFileSystem.requestFileSystem(
        type,
        size,
        (filesystem) => {
          resolve(new FileSystemAsync(filesystem));
        },
        (err) => {
          reject(err);
        }
      );
    });
  }

  resolveLocalFileSystemAsyncURL(url: string): Promise<EntryAsync<Entry>> {
    throw new NotImplementedError("", url);
  }
}
