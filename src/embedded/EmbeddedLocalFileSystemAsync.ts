import { EmbeddedLocalFileSystem } from "./EmbeddedLocalFileSystem";
import { LocalFileSystemAsync } from "../LocalFileSystemAsync";

export class EmbeddedLocalFileSystemAsync extends LocalFileSystemAsync {
  constructor() {
    super(new EmbeddedLocalFileSystem());
  }
}
