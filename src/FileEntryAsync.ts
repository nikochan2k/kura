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

  readFile(
    type?: "blob" | "arraybuffer" | "base64"
  ): Promise<Blob | ArrayBuffer | string> {
    return new Promise<Blob | ArrayBuffer | string>((resolve, reject) => {
      this.entry.readFile(
        (content) => {
          resolve(content);
        },
        (error) => {
          reject(error);
        },
        type
      );
    });
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

  writeFile(content: Blob | ArrayBuffer | string): Promise<void> {
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
