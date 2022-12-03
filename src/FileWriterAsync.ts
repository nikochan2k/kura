import { FileWriter } from "./filewriter";

export class FileWriterAsync {
  constructor(private fileWriter: FileWriter) {}

  public get length() {
    return this.fileWriter.length;
  }

  public get position() {
    return this.fileWriter.position;
  }

  public async appendFile(data: Blob) {
    this.seek(this.length);
    await this.write(data);
  }

  public seek(offset: number): void {
    this.fileWriter.seek(offset);
  }

  public truncate(size: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.fileWriter.onwriteend = () => resolve();
      this.fileWriter.onerror = (err) => reject(err);
      this.fileWriter.truncate(size);
    });
  }

  public write(data: Blob): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.fileWriter.onwriteend = () => resolve();
      this.fileWriter.onerror = (err) => reject(err);
      this.fileWriter.write(data);
    });
  }

  public async writeFile(data: Blob) {
    await this.truncate(0);
    await this.write(data);
  }
}
