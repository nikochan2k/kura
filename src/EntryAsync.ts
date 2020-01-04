import { createEntry } from "./FileSystemUtil";
import { DirectoryEntry, Entry, FileEntry, Metadata } from "./filesystem";
import { DirectoryEntryAsync } from "./DirectoryEntryAsync";
import { FileSystemAsync } from "./FileSystemAsync";

export abstract class EntryAsync<T extends Entry> {
  constructor(protected fileSystemAsync: FileSystemAsync, protected entry: T) {}

  get isFile() {
    return this.entry.isFile;
  }
  get isDirectory() {
    return this.entry.isDirectory;
  }
  get name() {
    return this.entry.name;
  }
  get fullPath() {
    return this.entry.fullPath;
  }
  get filesystem() {
    return this.fileSystemAsync;
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

  setMetadata(metadata: Metadata): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.entry.setMetadata(
        metadata,
        () => {
          resolve();
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
  ): Promise<EntryAsync<FileEntry | DirectoryEntry>> {
    return new Promise<EntryAsync<FileEntry | DirectoryEntry>>(
      (resolve, reject) => {
        this.entry.moveTo(
          parent,
          newName,
          entry => {
            resolve(createEntry(this.fileSystemAsync, entry));
          },
          error => {
            reject(error);
          }
        );
      }
    );
  }

  copyTo(
    parent: DirectoryEntryAsync,
    newName?: string
  ): Promise<EntryAsync<FileEntry | DirectoryEntry>> {
    return new Promise<EntryAsync<FileEntry | DirectoryEntry>>(
      (resolve, reject) => {
        this.entry.copyTo(
          parent,
          newName,
          entry => {
            resolve(createEntry(this.fileSystemAsync, entry));
          },
          error => {
            reject(error);
          }
        );
      }
    );
  }

  toURL(): string {
    return this.entry.toURL();
  }

  remove(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.entry.remove(
        () => {
          resolve();
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
}
