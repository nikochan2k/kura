import { AbstractAccessor } from "./AbstractAccessor";
import { AbstractFileSystem } from "./AbstractFileSystem";
import { DirectoryEntryAsync } from "./DirectoryEntryAsync";
import { resolveToFullPath } from "./FileSystemUtil";

export class FileSystemAsync {
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

  public async toURL(
    path: string,
    method?: "GET" | "POST" | "PUT" | "DELETE"
  ): Promise<string> {
    const fullPath = resolveToFullPath("", path);
    const rootPath = await this.root.toURL(method);
    return `${rootPath}${fullPath}`;
  }

  // #endregion Public Methods (1)
}
