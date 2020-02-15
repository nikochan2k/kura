import { DirectoryEntryAsync } from "./DirectoryEntryAsync";
import { NotImplementedError } from "./FileError";
import { FileSystem } from "./filesystem";
import { resolveToFullPath } from "./FileSystemUtil";

export class FileSystemAsync implements FileSystem {
  constructor(public filesystem: FileSystem) {}

  get name(): string {
    return this.filesystem.name;
  }

  get root(): DirectoryEntryAsync {
    return new DirectoryEntryAsync(this, this.filesystem.root);
  }

  toURL(path: string): string {
    const fullPath = resolveToFullPath("", path);
    return `${this.root.toURL()}${fullPath}`;
  }
}
