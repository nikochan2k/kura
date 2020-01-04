import { blobToFile, createEmptyFile } from "./FileSystemUtil";
import { FileEntry } from "./filesystem";
import { FileWriter } from "./filewriter";
import { NotImplementedError } from "./FileError";

export abstract class AbstractFileWriter<T extends FileEntry>
  implements FileWriter {
  constructor(protected fileEntry: T, public file: File) {}

  position = 0;

  get length() {
    return this.file.size;
  }

  protected handleError(err: Error) {
    if (this.onerror) {
      const evt: ProgressEvent<EventTarget> = {
        error: err,
        loaded: this.position,
        total: this.length,
        lengthComputable: true
      } as any;
      this.onerror(evt);
    } else {
      console.error(err);
    }
  }

  write(data: Blob): void {
    const current = this.file;
    if (current) {
      // Calc the head and tail fragments
      const head = current.slice(0, this.position);
      const tail = current.slice(this.position + data.size);

      // Calc the padding
      let padding = this.position - head.size;
      if (padding < 0) {
        padding = 0;
      }

      // Do the "write". In fact, a full overwrite of the Blob.
      // TODO: figure out if data.type should overwrite the exist blob's type.
      const file = blobToFile(
        [head, new Uint8Array(padding), data, tail],
        current.name,
        Date.now()
      );

      this.doWrite(file, () => {
        this.file = file;
        this.position += data.size;
      });
    } else {
      const file = blobToFile([data], this.fileEntry.name, Date.now());
      this.doWrite(file, () => {
        this.file = file;
        this.position = data.size;
      });
    }
  }

  protected abstract doWrite(file: File, onsuccess: () => void): void;

  seek(offset: number): void {
    this.position = offset;

    if (this.length < this.position) {
      this.position = this.length;
    } else if (this.position < 0) {
      this.position = 0;
    }
  }

  truncate(size: number): void {
    const current = this.file;
    let file: File;
    if (current) {
      if (size < this.length) {
        file = blobToFile([current.slice(0, size)], current.name, Date.now());
      } else {
        file = blobToFile(
          [current, new Uint8Array(size - this.length)],
          current.name,
          Date.now()
        );
      }
    } else {
      file = createEmptyFile(this.fileEntry.name);
    }

    this.doWrite(file, () => {
      this.file = file;
      this.position = 0;
    });
  }

  abort(): void {
    throw new NotImplementedError(
      this.fileEntry.filesystem.name,
      this.fileEntry.fullPath
    );
  }

  INIT: number;
  WRITING: number;
  DONE: number;
  readyState: number;
  error: Error;
  onwritestart: (event: ProgressEvent<EventTarget>) => void;
  onprogress: (event: ProgressEvent<EventTarget>) => void;
  onwrite: (event: ProgressEvent<EventTarget>) => void;
  onabort: (event: ProgressEvent<EventTarget>) => void;
  onerror: (event: ProgressEvent<EventTarget>) => void;
  onwriteend: (event: ProgressEvent<EventTarget>) => void;

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void {
    throw new NotImplementedError(
      this.fileEntry.filesystem.name,
      this.fileEntry.fullPath
    );
  }

  dispatchEvent(event: Event): boolean {
    throw new NotImplementedError(
      this.fileEntry.filesystem.name,
      this.fileEntry.fullPath
    );
  }

  removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ): void {
    throw new NotImplementedError(
      this.fileEntry.filesystem.name,
      this.fileEntry.fullPath
    );
  }
}
