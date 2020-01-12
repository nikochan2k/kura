import { AbstractDirectoryEntry } from "../AbstractDirectoryEntry";
import { DirectoryEntry, DirectoryReader, FileEntry } from "../filesystem";
import { FileSystemObject } from "../FileSystemObject";
import { FileSystemParams } from "../FileSystemParams";
import { IdbAccessor } from "./IdbAccessor";
import { IdbDirectoryReader } from "./IdbDirectoryReader";
import { IdbFileEntry } from "./IdbFileEntry";

export class IdbDirectoryEntry extends AbstractDirectoryEntry<IdbAccessor> {
  constructor(params: FileSystemParams<IdbAccessor>) {
    super(params);
  }

  createReader(): DirectoryReader {
    return new IdbDirectoryReader(this);
  }

  toDirectoryEntry(obj: FileSystemObject): DirectoryEntry {
    return new IdbDirectoryEntry({
      accessor: this.params.accessor,
      ...obj
    });
  }

  toFileEntry(obj: FileSystemObject): FileEntry {
    return new IdbFileEntry({
      accessor: this.params.accessor,
      ...obj
    });
  }
}
