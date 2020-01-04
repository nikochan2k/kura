import { DIR_SEPARATOR } from "../FileSystemConstants";
import { FileSystem } from "../filesystem";
import { Idb } from "./Idb";
import { IdbDirectoryEntry } from "./IdbDirectoryEntry";

export class IdbFileSystem implements FileSystem {
  get name() {
    return this.idb.db.name;
  }
  root: IdbDirectoryEntry;

  constructor(public idb: Idb) {
    this.root = new IdbDirectoryEntry({
      filesystem: this,
      name: "",
      fullPath: DIR_SEPARATOR,
      lastModified: null,
      size: null
    });
  }
}
