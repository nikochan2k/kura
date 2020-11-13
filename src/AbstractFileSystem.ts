import { AbstractAccessor } from "./AbstractAccessor";
import { AbstractDirectoryEntry } from "./AbstractDirectoryEntry";
import { DIR_SEPARATOR } from "./FileSystemConstants";
import { FileSystem } from "./filesystem";
import { FileSystemParams } from "./FileSystemParams";

export abstract class AbstractFileSystem<T extends AbstractAccessor>
  implements FileSystem {
  // #region Properties (1)

  public root: AbstractDirectoryEntry<T>;

  // #endregion Properties (1)

  // #region Constructors (1)

  constructor(public accessor: T) {
    this.root = this.createRoot({
      accessor: accessor,
      name: "",
      fullPath: DIR_SEPARATOR,
    });
  }

  // #endregion Constructors (1)

  // #region Public Accessors (1)

  public get name() {
    return this.accessor.name;
  }

  // #endregion Public Accessors (1)

  // #region Protected Abstract Methods (1)

  protected abstract createRoot(
    params: FileSystemParams<T>
  ): AbstractDirectoryEntry<T>;

  // #endregion Protected Abstract Methods (1)
}
