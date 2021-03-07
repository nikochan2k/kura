import { AbstractDirectoryEntry } from "../AbstractDirectoryEntry";
import { DirectoryEntry, FileEntry } from "../filesystem";
import { FileSystemObject } from "../FileSystemObject";
import { FileSystemParams } from "../FileSystemParams";
import { IdbAccessor } from "./IdbAccessor";
import { IdbFileEntry } from "./IdbFileEntry";

export class IdbDirectoryEntry extends AbstractDirectoryEntry<IdbAccessor> {
  // #region Constructors (1)

  constructor(params: FileSystemParams<IdbAccessor>) {
    super(params);
  }

  // #endregion Constructors (1)

  // #region Public Methods (2)

  public toDirectoryEntry(obj: FileSystemObject): DirectoryEntry {
    return new IdbDirectoryEntry({
      accessor: this.params.accessor,
      ...obj,
    });
  }

  public toFileEntry(obj: FileSystemObject): FileEntry {
    return new IdbFileEntry({
      accessor: this.params.accessor,
      ...obj,
    });
  }

  // #endregion Public Methods (2)

  // #region Protected Methods (1)

  protected createEntry(obj: FileSystemObject) {
    return obj.size != null
      ? new IdbFileEntry({
          accessor: this.params.accessor,
          ...obj,
        })
      : new IdbDirectoryEntry({
          accessor: this.params.accessor,
          ...obj,
        });
  }

  // #endregion Protected Methods (1)
}
