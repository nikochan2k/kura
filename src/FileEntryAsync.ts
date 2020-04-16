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

  readContent(
    type: "blob" | "arrayBuffer" | "base64" | "utf8"
  ): Promise<Blob | ArrayBuffer | string> {
    return new Promise<Blob | ArrayBuffer | string>((resolve, reject) => {
      this.entry.readContent(
        type,
        (content) => {
          resolve(content);
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  writeContent(
    content: Blob | ArrayBuffer | string,
    stringType?: "base64" | "utf8"
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.entry.writeContent(
        content,
        stringType,
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
