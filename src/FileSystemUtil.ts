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
  INDEX_DIR,
  LAST_DIR_SEPARATORS,
} from "./FileSystemConstants";
import { FileSystemObject } from "./FileSystemObject";

const LAST_PATH_PART = /\/([^\/]+)\/?$/;

export function getParentPath(fullPath: string) {
  const parentPath = fullPath.replace(LAST_PATH_PART, "");
  return parentPath === "" ? DIR_SEPARATOR : parentPath;
}

export function createFileSystemObject(
  fullPath: string,
  isFile: boolean
): FileSystemObject {
  const obj: FileSystemObject = {
    fullPath,
    name: getName(fullPath),
  };
  if (isFile) {
    obj.lastModified = Date.now();
    obj.size = 0;
  }
  return obj;
}

export function getName(fullPath: string) {
  if (!fullPath || fullPath === DIR_SEPARATOR) {
    return "";
  }
  if (fullPath.endsWith(DIR_SEPARATOR)) {
    fullPath = fullPath.substr(0, fullPath.length - 1);
  }
  const chunks = fullPath.split(DIR_SEPARATOR);
  if (0 < chunks.length) {
    return chunks[chunks.length - 1];
  } else {
    return fullPath;
  }
}

export function getExtension(fullPath: string) {
  if (!fullPath || fullPath === DIR_SEPARATOR) {
    return "";
  }
  const name = getName(fullPath);
  const chunks = name.split(".");
  if (chunks.length <= 1) {
    return "";
  } else if (chunks.length === 2) {
    if (!chunks[0]) {
      return name;
    } else {
      return chunks[1];
    }
  } else {
    return chunks[chunks.length - 1];
  }
}

export function getBaseName(fullPath: string) {
  if (!fullPath || fullPath === DIR_SEPARATOR) {
    return "";
  }
  const name = getName(fullPath);
  const chunks = name.split(".");
  if (chunks.length === 0) {
    return "";
  } else if (chunks.length === 1) {
    return chunks[0];
  } else if (chunks.length === 2) {
    if (!chunks[0]) {
      return name;
    } else {
      return chunks[0];
    }
  } else {
    chunks.splice(chunks.length - 1);
    return chunks.join(".");
  }
}

export function createEntry(fileSystemAsync: FileSystemAsync, entry: Entry) {
  return entry.isFile
    ? new FileEntryAsync(fileSystemAsync, entry as FileEntry)
    : new DirectoryEntryAsync(fileSystemAsync, entry as DirectoryEntry);
}

export function resolveToFullPath(cwdFullPath: string, path: string) {
  if (!path) {
    return cwdFullPath;
  }
  cwdFullPath = cwdFullPath.replace(LAST_DIR_SEPARATORS, "");
  const relativePath = path[0] != DIR_SEPARATOR;
  if (relativePath) {
    path = cwdFullPath + DIR_SEPARATOR + path;
  }
  return normalizePath(path);
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

export function getMemorySize(content: Blob | BufferSource | string) {
  if (!content) {
    return 0;
  }

  let size: number;
  if (typeof content === "string") {
    size = content.length * 2; // UTF-16
  } else if (content instanceof Blob) {
    size = content.size;
  } else {
    size = content.byteLength;
  }
  return size;
}

export function getSize(content: Blob | BufferSource | string) {
  if (!content) {
    return 0;
  }

  let size: number;
  if (typeof content === "string") {
    const length = content.length;
    let paddingCount = 0;
    for (let i = length - 1; 0 <= i; i--) {
      const c = content.charAt(i);
      if (c !== "=") {
        break;
      }
      paddingCount++;
    }
    size = length - paddingCount;
  } else if (content instanceof Blob) {
    size = content.size;
  } else {
    size = content.byteLength;
  }
  return size;
}

export function getTextSize(text: string) {
  return encodeURIComponent(text).replace(/%../g, "x").length; // UTF-8
}

export function isIllegalFileName(name: string) {
  return /[\x00-\x1f\x7f-\x9f\\/:*?"<>|]/.test(name);
}

export function isIllegalPath(fullPath: string) {
  if (fullPath === DIR_SEPARATOR) {
    return true;
  }
  if (fullPath.startsWith(INDEX_DIR)) {
    return true;
  }
  return false;
}

export function isIllegalObject(obj: FileSystemObject) {
  if (isIllegalPath(obj.fullPath)) {
    return true;
  }
  if (isIllegalFileName(obj.name)) {
    return true;
  }

  return false;
}

export async function vacuumDirectory(
  accessor: AbstractAccessor,
  dirPath: string
) {
  const fileNameIndex = await accessor.doGetFileNameIndex(dirPath);
  for (const [name, record] of Object.entries(fileNameIndex)) {
    const obj = record.obj;
    if (obj.size == null) {
      await vacuumDirectory(accessor, obj.fullPath);
    }
    delete fileNameIndex[name];
  }
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
  await vacuumDirectory(accessor, filesystem.root.fullPath);
}

export function onError(err: any, errorCallback?: ErrorCallback) {
  if (errorCallback) {
    errorCallback(err);
  } else {
    console.error(err);
  }
}
