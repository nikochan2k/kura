import { DirectoryEntryAsync } from "./DirectoryEntryAsync";
import { FileEntryAsync } from "./FileEntryAsync";
import { NotFoundError } from "./FileError";
import { Entry, Metadata } from "./filesystem";
import { FileSystemAsync } from "./FileSystemAsync";
import { createEntry } from "./FileSystemUtil";

export abstract class EntryAsync<T extends Entry> {
  // #region Constructors (1)

  constructor(protected fileSystemAsync: FileSystemAsync, public entry: T) {}

  // #endregion Constructors (1)

  // #region Public Accessors (5)

  public get filesystem() {
    return this.fileSystemAsync;
  }

  public get fullPath() {
    return this.entry.fullPath;
  }

  public get isDirectory() {
    return this.entry.isDirectory;
  }

  public get isFile() {
    return this.entry.isFile;
  }

  public get name() {
    return this.entry.name;
  }

  // #endregion Public Accessors (5)

  // #region Public Methods (6)

  public copyTo(
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
          (err) => reject(err)
        );
      }
    );
  }

  public getMetadata(): Promise<Metadata> {
    return new Promise<Metadata>((resolve, reject) => {
      this.entry.getMetadata(
        (metadata) => resolve(metadata),
        (err) => reject(err)
      );
    });
  }

  public getParent(): Promise<DirectoryEntryAsync> {
    return new Promise<DirectoryEntryAsync>((resolve, reject) => {
      this.entry.getParent(
        (entry) =>
          resolve(new DirectoryEntryAsync(this.fileSystemAsync, entry)),
        (err) => {
          reject(err);
        }
      );
    });
  }

  public moveTo(
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

  public remove(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.entry.remove(
        () => resolve(),
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

  public toURL(method?: "GET" | "POST" | "PUT" | "DELETE"): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.entry.toURL(
        (url) => resolve(url),
        (err) => reject(err),
        method
      );
    });
  }

  // #endregion Public Methods (6)
}
