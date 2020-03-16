import { decode } from "base-64";

global.Buffer = global.Buffer || require("buffer").Buffer;

if (navigator && navigator.product == "ReactNative") {
  (process as any).browser = true;

  FileReader.prototype.readAsArrayBuffer = function(blob) {
    if (this.readyState === this.LOADING) throw new Error("InvalidStateError");
    (this as any)._setReadyState(this.LOADING);
    (this as any)._result = null;
    (this as any)._error = null;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Url = reader.result as string;
      const base64 = base64Url.substr(base64Url.indexOf(",") + 1);
      const content = decode(base64);
      const buffer = new ArrayBuffer(content.length);
      const view = new Uint8Array(buffer);
      view.set(Array.from(content).map(c => c.charCodeAt(0)));
      (this as any)._result = buffer;
      (this as any)._setReadyState(this.DONE);
    };
    reader.readAsDataURL(blob);
  };
}

export * from "./AbstractAccessor";
export * from "./AbstractDirectoryEntry";
export * from "./AbstractDirectoryReader";
export * from "./AbstractFileEntry";
export * from "./AbstractFileSystem";
export * from "./AbstractFileWriter";
export * from "./AbstractLocalFileSystem";
export * from "./DirectoryEntryAsync";
export * from "./DirectoryReaderAsync";
export * from "./EntryAsync";
export * from "./FileEntryAsync";
export * from "./FileError";
export * from "./filesystem";
export * from "./FileSystemAsync";
export * from "./FileSystemConstants";
export * from "./FileSystemIndex";
export * from "./FileSystemObject";
export * from "./FileSystemParams";
export * from "./FileSystemUtil";
export * from "./filewriter";
export * from "./FileWriterAsync";
export * from "./LocalFileSystemAsync";
export * from "./default";
export * from "./embedded";
export * from "./idb";
