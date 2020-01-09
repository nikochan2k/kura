import { AbstractEntrySupport } from "../AbstractEntrySupport";
import { DIR_SEPARATOR } from "../FileSystemConstants";
import { DirectoryEntry, FileEntry } from "../filesystem";
import { FileSystemObject } from "../FileSystemObject";
import { FileSystemParams } from "../FileSystemParams";
import { IdbDirectoryEntry } from "./IdbDirectoryEntry";
import { IdbFileEntry } from "./IdbFileEntry";
import { IdbFileSystem } from "./IdbFileSystem";

export class IdbEntrySupport extends AbstractEntrySupport {
  constructor(private params: FileSystemParams<IdbFileSystem>) {
    super();
  }

  toDirectoryEntry(obj: FileSystemObject): DirectoryEntry {
    return new IdbDirectoryEntry({
      filesystem: this.params.filesystem,
      ...obj
    });
  }

  toFileEntry(obj: FileSystemObject): FileEntry {
    return new IdbFileEntry({
      filesystem: this.params.filesystem,
      ...obj
    });
  }

  getDirectoryObject(path: string): Promise<FileSystemObject> {
    return this.params.filesystem.idb.getEntry(path);
  }

  getFileObject(path: string): Promise<FileSystemObject> {
    return this.params.filesystem.idb.getEntry(path);
  }

  toURL(): string {
    return `idb:${location.protocol}:${location.host}:${location.port}${DIR_SEPARATOR}${this.params.fullPath}`;
  }
}
