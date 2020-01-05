import { IdbLocalFileSystem } from "./IdbLocalFileSystem";
import { LocalFileSystemAsync } from "../LocalFileSystemAsync";

export class IdbLocalFileSystemAsync extends LocalFileSystemAsync {
  constructor(bucket: string, useIndex?: boolean) {
    super(new IdbLocalFileSystem(bucket, useIndex));
  }
}
