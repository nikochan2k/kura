import { AbstractDirectoryEntry } from "../AbstractDirectoryEntry";
import { AbstractFileSystem } from "../AbstractFileSystem";
import { FileSystemParams } from "../FileSystemParams";
import { IdbAccessor } from "./IdbAccessor";
import { IdbDirectoryEntry } from "./IdbDirectoryEntry";

export class IdbFileSystem extends AbstractFileSystem<IdbAccessor> {
  // #region Properties (1)

  public root: IdbDirectoryEntry;

  // #endregion Properties (1)

  // #region Constructors (1)

  constructor(accessor: IdbAccessor) {
    super(accessor);
  }

  // #endregion Constructors (1)

  // #region Protected Methods (1)

  protected createRoot(
    params: FileSystemParams<IdbAccessor>
  ): AbstractDirectoryEntry<IdbAccessor> {
    return new IdbDirectoryEntry(params);
  }

  // #endregion Protected Methods (1)
}
