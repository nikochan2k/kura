import { DirectoryEntryAsync } from "./DirectoryEntryAsync";
import { FileSystem } from "./filesystem";

export class FileSystemAsync {
  constructor(private fileSystem: FileSystem) {}

  get name(): string {
    return this.fileSystem.name;
  }

  get root(): DirectoryEntryAsync {
    return new DirectoryEntryAsync(this, this.fileSystem.root);
  }
}
