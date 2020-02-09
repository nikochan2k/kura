import { FileWriter } from "./filewriter";

export class FileWriterAsync {
  constructor(private fileWriter: FileWriter) {}

  get length() {
    return this.fileWriter.length;
  }

  get position() {
    return this.fileWriter.position;
  }

  seek(offset: number): void {
    this.fileWriter.seek(offset);
  }

  truncate(size: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.fileWriter.onwriteend = () => {
        resolve();
      };
      try {
        this.fileWriter.truncate(size);
      } catch (err) {
        reject(err);
      }
    });
  }

  write(data: Blob): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.fileWriter.onwriteend = () => {
        resolve();
      };
      try {
        this.fileWriter.write(data);
      } catch (err) {
        reject(err);
      }
    });
  }

  writeFile(data: Blob): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.fileWriter.onwriteend = () => {
        this.fileWriter.onwriteend = () => {
          resolve();
        };
        try {
          this.fileWriter.write(data);
        } catch (err) {
          reject(err);
        }
      };
      try {
        this.fileWriter.truncate(0);
      } catch (err) {
        reject(err);
      }
    });
  }

  appendFile(data: Blob): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.seek(this.fileWriter.length);
      this.fileWriter.onwriteend = () => {
        resolve();
      };
      try {
        this.fileWriter.write(data);
      } catch (err) {
        reject(err);
      }
    });
  }
}
