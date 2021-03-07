import { AbstractDirectoryEntry } from "../AbstractDirectoryEntry";
import { NotImplementedError } from "../FileError";
import { DirectoryEntry, DirectoryReader, FileEntry } from "../filesystem";
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

  // #region Public Methods (3)

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

  public toURL(): string {
    throw new NotImplementedError(
      this.filesystem.name,
      this.params.fullPath,
      "toURL"
    );
  }

  // #endregion Public Methods (3)

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
