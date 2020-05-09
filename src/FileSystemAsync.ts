import { AbstractAccessor } from "./AbstractAccessor";
import { AbstractFileSystem } from "./AbstractFileSystem";
import { DirectoryEntryAsync } from "./DirectoryEntryAsync";
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

  clearContentsCache(prefix?: string) {
    const afs = this.filesystem as AbstractFileSystem<AbstractAccessor>;
    afs.accessor.clearContentsCache(prefix);
  }

  toURL(path: string): string {
    const fullPath = resolveToFullPath("", path);
    return `${this.root.toURL()}${fullPath}`;
  }
}
