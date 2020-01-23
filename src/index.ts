if (!Blob) {
  (global as any).Blob = require("./node/NodeBlob");
  (global as any).File = require("./node/NodeFile");
}

import * as Default from "./default";
import * as Embedded from "./embedded";
import * as Idb from "./idb";
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
export { Default, Embedded, Idb };
