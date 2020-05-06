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
      this.fileWriter.onerror = (err) => {
        reject(err);
      };
      this.fileWriter.truncate(size);
    });
  }

  write(data: Blob): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.fileWriter.onwriteend = () => {
        resolve();
      };
      this.fileWriter.onerror = (err) => {
        reject(err);
      };
      this.fileWriter.write(data);
    });
  }

  async writeFile(data: Blob) {
    await this.truncate(0);
    await this.write(data);
  }

  async appendFile(data: Blob) {
    this.seek(this.length);
    await this.write(data);
  }
}
