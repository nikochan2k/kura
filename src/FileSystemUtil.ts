import { AbstractAccessor } from "./AbstractAccessor";
import { AbstractFileSystem } from "./AbstractFileSystem";
import { DirectoryEntryAsync } from "./DirectoryEntryAsync";
import { FileEntryAsync } from "./FileEntryAsync";
import {
  DirectoryEntry,
  Entry,
  ErrorCallback,
  FileEntry,
  FileSystem,
} from "./filesystem";
import { FileSystemAsync } from "./FileSystemAsync";
import {
  DEFAULT_CONTENT_TYPE,
  DIR_SEPARATOR,
  LAST_DIR_SEPARATORS,
} from "./FileSystemConstants";

const LAST_PATH_PART = /\/([^\/]+)\/?$/;

export function getParentPath(fullPath: string) {
  const parentPath = fullPath.replace(LAST_PATH_PART, "");
  return parentPath === "" ? DIR_SEPARATOR : parentPath;
}

export function getName(fullPath: string) {
  const result = LAST_PATH_PART.exec(fullPath);
  if (!result || result.length === 0) {
    return "";
  }
  return result[1];
}

export function createEntry(fileSystemAsync: FileSystemAsync, entry: Entry) {
  return entry.isFile
    ? new FileEntryAsync(fileSystemAsync, entry as FileEntry)
    : new DirectoryEntryAsync(fileSystemAsync, entry as DirectoryEntry);
}

export function resolveToFullPath(cwdFullPath: string, path: string) {
  let fullPath = path;
  cwdFullPath = cwdFullPath.replace(LAST_DIR_SEPARATORS, "");
  const relativePath = path[0] != DIR_SEPARATOR;
  if (relativePath) {
    fullPath = cwdFullPath + DIR_SEPARATOR + path;
  }
  return normalizePath(fullPath);
}

export function normalizePath(fullPath: string) {
  // Normalize '.'s,  '..'s and '//'s.
  const parts = fullPath.split(DIR_SEPARATOR);
  const finalParts = [];
  for (const part of parts) {
    if (part === "..") {
      // Go up one level.
      if (!finalParts.length) {
        throw Error("Invalid path");
      }
      finalParts.pop();
    } else if (part === ".") {
      // Skip over the current directory.
    } else if (part !== "") {
      // Eliminate sequences of '/'s as well as possible leading/trailing '/'s.
      finalParts.push(part);
    }
  }

  fullPath = DIR_SEPARATOR + finalParts.join(DIR_SEPARATOR);

  // fullPath is guaranteed to be normalized by construction at this point:
  // '.'s, '..'s, '//'s will never appear in it.
  return fullPath;
}

export function blobToFile(
  fileBits: BlobPart[],
  name: string,
  lastModified: number,
  type?: string
) {
  const file = new File(fileBits, name, {
    lastModified: lastModified,
    type: type || DEFAULT_CONTENT_TYPE,
  });
  return file;
}

export function dataUrlToBase64(dataUrl: string) {
  const index = dataUrl.indexOf(",");
  if (0 <= index) {
    return dataUrl.substr(index + 1);
  }
  return dataUrl;
}

export function createEmptyFile(name: string) {
  return new File([], name, {
    lastModified: Date.now(),
    type: DEFAULT_CONTENT_TYPE,
  });
}

export function getSize(content: Blob | Uint8Array | ArrayBuffer | string) {
  if (!content) {
    return 0;
  }

  let size: number;
  if (content instanceof Blob) {
    size = content.size;
  } else if (content instanceof ArrayBuffer) {
    size = content.byteLength;
  } else if (ArrayBuffer.isView(content)) {
    size = content.byteLength;
  } else {
    size = Math.floor(content.replace(/=/g, "").length * 0.75); // Base64
  }
  return size;
}

export function getTextSize(text: string) {
  return encodeURIComponent(text).replace(/%../g, "x").length; // UTF-8
}

export async function vacuum(filesystem: FileSystem) {
  if (!(filesystem instanceof AbstractFileSystem)) {
    console.info("This is not kura FileSystem.");
    return;
  }

  const afs = filesystem as AbstractFileSystem<AbstractAccessor>;
  const accessor = afs.accessor;
  if (!accessor.options.index) {
    console.info("This filesystem does not use index.");
    return;
  }

  const dirPathIndex = await afs.accessor.getDirPathIndex();
  for (const fileNameIndex of Object.values(dirPathIndex)) {
    const namesToDelete: string[] = [];
    for (const [name, record] of Object.entries(fileNameIndex)) {
      if (record.deleted) {
        namesToDelete.push(name);
      }
    }
    for (const name of namesToDelete) {
      delete fileNameIndex[name];
    }
  }
  await afs.accessor.saveDirPathIndex();
}

export function onError(err: DOMError, errorCallback?: ErrorCallback) {
  if (errorCallback) {
    errorCallback(err);
  } else {
    console.error(err);
  }
}
