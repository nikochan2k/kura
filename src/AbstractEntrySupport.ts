import { DirectoryEntry, FileEntry } from "./filesystem";
import { FileSystemObject } from "./FileSystemObject";

export abstract class AbstractEntrySupport {
  abstract getDirectoryObject(path: string): Promise<FileSystemObject>;
  abstract getFileObject(path: string): Promise<FileSystemObject>;
  abstract toDirectoryEntry(obj: FileSystemObject): DirectoryEntry;
  abstract toFileEntry(obj: FileSystemObject): FileEntry;
  abstract toURL(): string;
}
