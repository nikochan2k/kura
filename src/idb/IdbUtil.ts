import { DIR_OPEN_BOUND, DIR_SEPARATOR } from "../FileSystemConstants";
import { DirectoryEntry, FileEntry } from "../filesystem";
import { FileSystemObject } from "../FileSystemObject";
import { IdbAccessor } from "./IdbAccessor";
import { IdbDirectoryEntry } from "./IdbDirectoryEntry";
import { IdbFileEntry } from "./IdbFileEntry";

export function countSlash(path: string) {
  let result = 0;
  for (let i = 0, end = path.length; i < end; i++) {
    if (path[i] === "/") {
      result++;
    }
  }
  return result;
}

export function createDirectoryEntry(
  accessor: IdbAccessor,
  obj: FileSystemObject
): DirectoryEntry {
  return new IdbDirectoryEntry({
    accessor: accessor,
    ...obj,
  });
}

export function createFileEntry(
  accessor: IdbAccessor,
  obj: FileSystemObject
): FileEntry {
  return new IdbFileEntry({
    accessor: accessor,
    ...obj,
  });
}

export function getRange(fullPath: string) {
  if (fullPath === DIR_SEPARATOR) {
    return IDBKeyRange.bound(DIR_SEPARATOR, DIR_OPEN_BOUND, false, true);
  } else {
    return IDBKeyRange.bound(
      fullPath + DIR_SEPARATOR,
      fullPath + DIR_OPEN_BOUND,
      false,
      true
    );
  }
}
