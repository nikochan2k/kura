import { AbstractFileEntry } from "../AbstractFileEntry";
import { NotImplementedError } from "../FileError";
import { DirectoryEntry } from "../filesystem";
import { FileSystemObject } from "../FileSystemObject";
import { FileSystemParams } from "../FileSystemParams";
import { IdbAccessor } from "./IdbAccessor";
import { IdbDirectoryEntry } from "./IdbDirectoryEntry";
import { IdbFileWriter } from "./IdbFileWriter";

export class IdbFileEntry extends AbstractFileEntry<IdbAccessor> {
  // #region Constructors (1)

  constructor(params: FileSystemParams<IdbAccessor>) {
    super(params);
  }

  // #endregion Constructors (1)

  // #region Public Methods (1)

  public toURL(): string {
    throw new NotImplementedError(
      this.filesystem.name,
      this.params.fullPath,
      "toURL"
    );
  }

  // #endregion Public Methods (1)

  // #region Protected Methods (2)

  protected createFileWriter(file: File): IdbFileWriter {
    return new IdbFileWriter(this, file);
  }

  protected toDirectoryEntry(obj: FileSystemObject): DirectoryEntry {
    return new IdbDirectoryEntry({
      accessor: this.params.accessor,
      ...obj,
    });
  }

  // #endregion Protected Methods (2)
}
