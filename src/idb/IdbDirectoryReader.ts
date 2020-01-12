import { AbstractDirectoryReader } from "../AbstractDirectoryReader";
import { FileSystemObject } from "../FileSystemObject";
import { IdbAccessor } from "./IdbAccessor";
import { IdbDirectoryEntry } from "./IdbDirectoryEntry";
import { IdbFileEntry } from "./IdbFileEntry";

export class IdbDirectoryReader extends AbstractDirectoryReader<IdbAccessor> {
  constructor(public dirEntry: IdbDirectoryEntry) {
    super(dirEntry);
  }

  createEntry(obj: FileSystemObject) {
    return obj.size != null
      ? new IdbFileEntry({
          accessor: this.dirEntry.params.accessor,
          ...obj
        })
      : new IdbDirectoryEntry({
          accessor: this.dirEntry.params.accessor,
          ...obj
        });
  }
}
