import { AbstractAccessor } from "./AbstractAccessor";
import { AbstractFileSystem } from "./AbstractFileSystem";
import { DirectoryEntryAsync } from "./DirectoryEntryAsync";
import { FileSystem } from "./filesystem";
import { resolveToFullPath } from "./FileSystemUtil";

export class FileSystemAsync implements FileSystem {
  // #region Constructors (1)

  constructor(public filesystem: AbstractFileSystem<AbstractAccessor>) {}

  // #endregion Constructors (1)

  // #region Public Accessors (2)

  public get name(): string {
    return this.filesystem.name;
  }

  public get root(): DirectoryEntryAsync {
    return new DirectoryEntryAsync(this, this.filesystem.root);
  }

  // #endregion Public Accessors (2)

  // #region Public Methods (1)

  public toURL(path: string): string {
    const fullPath = resolveToFullPath("", path);
    return `${this.root.toURL()}${fullPath}`;
  }

  // #endregion Public Methods (1)
}
