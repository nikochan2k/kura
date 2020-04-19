import { EntryAsync } from "./EntryAsync";
import { DataType, FileEntry } from "./filesystem";
import { FileSystemAsync } from "./FileSystemAsync";
import { FileWriterAsync } from "./FileWriterAsync";

export class FileEntryAsync extends EntryAsync<FileEntry> {
  constructor(fileSystemAsync: FileSystemAsync, fileEntry: FileEntry) {
    super(fileSystemAsync, fileEntry);
  }

  createWriter(): Promise<FileWriterAsync> {
    return new Promise<FileWriterAsync>((resolve, reject) => {
      this.entry.createWriter(
        (fileWriter) => {
          resolve(new FileWriterAsync(fileWriter));
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  file(): Promise<File> {
    return new Promise((resolve, reject) => {
      this.entry.file(
        (file) => {
          resolve(file);
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  readFile(type?: DataType): Promise<Blob | Uint8Array | ArrayBuffer | string> {
    return new Promise<Blob | Uint8Array | ArrayBuffer | string>(
      (resolve, reject) => {
        this.entry.readFile(
          (content) => {
            resolve(content);
          },
          (error) => {
            reject(error);
          },
          type
        );
      }
    );
  }

  readText(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.entry.readText(
        (text) => {
          resolve(text);
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  writeFile(content: Blob | Uint8Array | ArrayBuffer | string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.entry.writeFile(
        content,
        () => {
          resolve();
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  writeText(text: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.entry.writeText(
        text,
        () => {
          resolve();
        },
        (error) => {
          reject(error);
        }
      );
    });
  }
}
