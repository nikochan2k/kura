import { AbstractFileEntry } from "../AbstractFileEntry";
import { DirectoryEntry } from "../filesystem";
import { FileSystemObject } from "../FileSystemObject";
import { FileSystemParams } from "../FileSystemParams";
import { IdbAccessor } from "./IdbAccessor";
import { IdbDirectoryEntry } from "./IdbDirectoryEntry";
import { IdbFileWriter } from "./IdbFileWriter";

export class IdbFileEntry extends AbstractFileEntry<IdbAccessor> {
  constructor(params: FileSystemParams<IdbAccessor>) {
    super(params);
  }

  toDirectoryEntry(obj: FileSystemObject): DirectoryEntry {
    return new IdbDirectoryEntry({
      accessor: this.params.accessor,
      ...obj
    });
  }

  protected createFileWriter(file: File): IdbFileWriter {
    return new IdbFileWriter(this, file);
  }
}
