import { AbstractAccessor } from "./AbstractAccessor";
import { AbstractFileSystem } from "./AbstractFileSystem";
import { DirectoryEntryAsync } from "./DirectoryEntryAsync";
import { resolveToFullPath } from "./FileSystemUtil";

export class FileSystemAsync {
  constructor(public filesystem: AbstractFileSystem<AbstractAccessor>) {}

  public get name(): string {
    return this.filesystem.name;
  }

  public get root(): DirectoryEntryAsync {
    return new DirectoryEntryAsync(this, this.filesystem.root);
  }

  public async toURL(
    path: string,
    method?: "GET" | "POST" | "PUT" | "DELETE"
  ): Promise<string> {
    const fullPath = resolveToFullPath("", path);
    const rootPath = await this.root.toURL(method);
    return `${rootPath}${fullPath}`;
  }
}
