import { EntryAsync } from "./EntryAsync";
import { DataType, FileEntry } from "./filesystem";
import { FileSystemAsync } from "./FileSystemAsync";
import { FileWriterAsync } from "./FileWriterAsync";

export class FileEntryAsync extends EntryAsync<FileEntry> {
  // #region Constructors (1)

  constructor(fileSystemAsync: FileSystemAsync, fileEntry: FileEntry) {
    super(fileSystemAsync, fileEntry);
  }

  // #endregion Constructors (1)

  // #region Public Methods (6)

  public createWriter(): Promise<FileWriterAsync> {
    return new Promise<FileWriterAsync>((resolve, reject) => {
      this.entry.createWriter(
        (fileWriter) => resolve(new FileWriterAsync(fileWriter)),
        (err) => reject(err)
      );
    });
  }

  public file(): Promise<File> {
    return new Promise((resolve, reject) => {
      this.entry.file(
        (file) => resolve(file),
        (err) => reject(err)
      );
    });
  }

  public readFile(type?: DataType): Promise<Blob | BufferSource | string> {
    return new Promise<Blob | BufferSource | string>((resolve, reject) => {
      this.entry.readFile(
        (content) => resolve(content),
        (err) => reject(err),
        type
      );
    });
  }

  public readText(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.entry.readText(
        (text) => resolve(text),
        (err) => reject(err)
      );
    });
  }

  public writeFile(content: Blob | BufferSource | string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.entry.writeFile(
        content,
        () => resolve(),
        (err) => reject(err)
      );
    });
  }

  public writeText(text: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.entry.writeText(
        text,
        () => resolve(),
        (err) => reject(err)
      );
    });
  }

  // #endregion Public Methods (6)
}
