import { AbstractAccessor } from "./AbstractAccessor";
import { AbstractFileEntry } from "./AbstractFileEntry";
import { blobToFile, createEmptyFile } from "./FileSystemUtil";
import { FileSystemObject } from "./FileSystemObject";
import { FileWriter } from "./filewriter";
import { NotImplementedError } from "./FileError";

export abstract class AbstractFileWriter<T extends AbstractAccessor>
  implements FileWriter {
  DONE: number;
  INIT: number;
  WRITING: number;
  error: Error;
  onabort: (event: ProgressEvent<EventTarget>) => void;
  onerror: (event: ProgressEvent<EventTarget>) => void;
  onprogress: (event: ProgressEvent<EventTarget>) => void;
  onwrite: (event: ProgressEvent<EventTarget>) => void;
  onwriteend: (event: ProgressEvent<EventTarget>) => void;
  onwritestart: (event: ProgressEvent<EventTarget>) => void;
  position = 0;
  readyState: number;

  constructor(protected fileEntry: AbstractFileEntry<T>, public file: File) {}

  get length() {
    return this.fileEntry.size;
  }

  abort(): void {
    throw new NotImplementedError(
      this.fileEntry.filesystem.name,
      this.fileEntry.fullPath
    );
  }

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

  write(data: Blob): void {
    const current = this.file;
    if (current) {
      const head = current.slice(0, this.position);
      const tail = current.slice(this.position + data.size);
      let padding = this.position - head.size;
      if (padding < 0) {
        padding = 0;
      }

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

  protected doWrite(blob: Blob, onsuccess: () => void) {
    const obj: FileSystemObject = {
      name: this.fileEntry.name,
      fullPath: this.fileEntry.fullPath,
      lastModified: Date.now(),
      size: blob.size,
    };

    const accessor = this.fileEntry.params.accessor;
    accessor
      .putObject(obj, blob)
      .then(async () => {
        this.fileEntry.params.lastModified = obj.lastModified;
        this.fileEntry.params.size = obj.size;
        onsuccess();
        if (this.onwriteend) {
          const evt: ProgressEvent<EventTarget> = {
            loaded: this.position,
            total: this.length,
            lengthComputable: true,
          } as any;
          this.onwriteend(evt);
        }
      })
      .catch((err) => {
        this.handleError(err);
      });
  }

  protected handleError(err: Error) {
    if (this.onerror) {
      const evt: ProgressEvent<EventTarget> = {
        error: err,
        loaded: this.position,
        total: this.length,
        lengthComputable: true,
      } as any;
      this.onerror(evt);
    } else {
      console.error(err);
    }
  }
}
