import { DirectoryEntryAsync } from "./DirectoryEntryAsync";
import { FileEntryAsync } from "./FileEntryAsync";
import { NotFoundError } from "./FileError";
import { Entry, Metadata } from "./filesystem";
import { FileSystemAsync } from "./FileSystemAsync";
import { createEntry } from "./FileSystemUtil";

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
          (entry) => {
            const entryAsync = createEntry(this.fileSystemAsync, entry);
            resolve(entryAsync);
          },
          (err) => {
            reject(err);
          }
        );
      }
    );
  }

  getMetadata(): Promise<Metadata> {
    return new Promise<Metadata>((resolve, reject) => {
      this.entry.getMetadata(
        (metadata) => {
          resolve(metadata);
        },
        (err) => {
          reject(err);
        }
      );
    });
  }

  getParent(): Promise<DirectoryEntryAsync> {
    return new Promise<DirectoryEntryAsync>((resolve, reject) => {
      this.entry.getParent(
        (entry) => {
          resolve(new DirectoryEntryAsync(this.fileSystemAsync, entry));
        },
        (err) => {
          reject(err);
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
          (entry) => {
            const entryAsync = createEntry(this.fileSystemAsync, entry);
            resolve(entryAsync);
          },
          (err) => {
            reject(err);
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
        (err) => {
          if (err instanceof NotFoundError) {
            resolve();
            return;
          }
          reject(err);
        }
      );
    });
  }

  toURL(): string {
    return this.entry.toURL();
  }
}
