import { AbstractAccessor } from "./AbstractAccessor";
import { AbstractDirectoryEntry } from "./AbstractDirectoryEntry";
import { DIR_SEPARATOR } from "./FileSystemConstants";
import { FileSystem } from "./filesystem";
import { FileSystemParams } from "./FileSystemParams";

export abstract class AbstractFileSystem<T extends AbstractAccessor>
  implements FileSystem
{
  public root: AbstractDirectoryEntry<T>;

  constructor(public accessor: T) {
    this.root = this.createRoot({
      accessor: accessor,
      name: "",
      fullPath: DIR_SEPARATOR,
    });
  }

  public get name() {
    return this.accessor.name;
  }

  protected abstract createRoot(
    params: FileSystemParams<T>
  ): AbstractDirectoryEntry<T>;
}
