import { DIR_SEPARATOR } from "../FileSystemConstants";
import { FileSystem } from "../filesystem";
import { IdbAccessor } from "./IdbAccessor";
import { IdbDirectoryEntry } from "./IdbDirectoryEntry";

export class IdbFileSystem implements FileSystem {
  root: IdbDirectoryEntry;

  constructor(public accessor: IdbAccessor) {
    this.root = new IdbDirectoryEntry({
      filesystem: this,
      name: "",
      fullPath: DIR_SEPARATOR
    });
  }

  get name() {
    return this.accessor.db.name;
  }
}
