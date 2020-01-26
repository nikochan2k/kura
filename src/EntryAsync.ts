import { createEntry } from "./FileSystemUtil";
import { DirectoryEntryAsync } from "./DirectoryEntryAsync";
import { Entry, Metadata } from "./filesystem";
import { FileEntryAsync } from "./FileEntryAsync";
import { FileSystemAsync } from "./FileSystemAsync";
import { NotFoundError, InvalidModificationError } from "./FileError";

export abstract class EntryAsync<T extends Entry> {
  constructor(protected fileSystemAsync: FileSystemAsync, public entry: T) {}

  get filesystem() {
    return this.fileSystemAsync;
  }
  get fullPath() {
    return this.entry.fullPath;
  }
  get isDirectory() {
    return this.entry.isDirectory;
  }
  get isFile() {
    return this.entry.isFile;
  }
  get name() {
    return this.entry.name;
  }

  copyTo(
    parent: DirectoryEntryAsync,
    newName?: string
  ): Promise<FileEntryAsync | DirectoryEntryAsync> {
    return new Promise<FileEntryAsync | DirectoryEntryAsync>(
      (resolve, reject) => {
        this.entry.copyTo(
          parent.entry,
          newName,
          entry => {
            const entryAsync = createEntry(this.fileSystemAsync, entry);
            resolve(entryAsync);
          },
          error => {
            reject(error);
          }
        );
      }
    );
  }

  getMetadata(): Promise<Metadata> {
    return new Promise<Metadata>((resolve, reject) => {
      this.entry.getMetadata(
        metadata => {
          resolve(metadata);
        },
        error => {
          reject(error);
        }
      );
    });
  }

  getParent(): Promise<DirectoryEntryAsync> {
    return new Promise<DirectoryEntryAsync>((resolve, reject) => {
      this.entry.getParent(
        entry => {
          resolve(new DirectoryEntryAsync(this.fileSystemAsync, entry));
        },
        error => {
          reject(error);
        }
      );
    });
  }

  moveTo(
    parent: DirectoryEntryAsync,
    newName?: string
  ): Promise<FileEntryAsync | DirectoryEntryAsync> {
    return new Promise<FileEntryAsync | DirectoryEntryAsync>(
      (resolve, reject) => {
        this.entry.moveTo(
          parent.entry,
          newName,
          entry => {
            const entryAsync = createEntry(this.fileSystemAsync, entry);
            resolve(entryAsync);
          },
          error => {
            reject(error);
          }
        );
      }
    );
  }

  remove(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.entry.remove(
        () => {
          resolve();
        },
        error => {
          if (error instanceof NotFoundError) {
            resolve();
            return;
          }
          reject(error);
        }
      );
    });
  }

  toURL(): string {
    return this.entry.toURL();
  }
}
