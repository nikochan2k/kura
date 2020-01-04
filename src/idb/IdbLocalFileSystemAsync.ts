import { IdbLocalFileSystem } from "./IdbLocalFileSystem";
import { LocalFileSystemAsync } from "../LocalFileSystemAsync";

export class IdbLocalFileSystemAsync extends LocalFileSystemAsync {
  constructor(bucket: string) {
    super(new IdbLocalFileSystem(bucket));
  }
}
