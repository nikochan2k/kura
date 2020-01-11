import { AbstractDirectoryEntry } from "../AbstractDirectoryEntry";
import { DIR_SEPARATOR } from "../FileSystemConstants";
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

  toURL(): string {
    return `idb:${location.protocol}:${location.host}:${location.port}${DIR_SEPARATOR}${this.params.fullPath}`;
  }
}
