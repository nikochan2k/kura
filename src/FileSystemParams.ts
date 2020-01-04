import { FileSystem } from "./filesystem";
import { FileSystemObject } from "./FileSystemObject";

export interface FileSystemParams<FS extends FileSystem>
  extends FileSystemObject {
  filesystem: FS;
}
