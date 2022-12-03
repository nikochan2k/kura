import { DefaultLocalFileSystem } from "./DefaultLocalFileSystem";
import { LocalFileSystemAsync } from "../LocalFileSystemAsync";

export class DefaultLocalFileSystemAsync extends LocalFileSystemAsync {
  constructor() {
    super(new DefaultLocalFileSystem());
  }
}
