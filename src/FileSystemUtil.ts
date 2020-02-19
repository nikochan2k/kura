import { decode } from "base-64";
import { DirectoryEntryAsync } from "./DirectoryEntryAsync";
import { FileEntryAsync } from "./FileEntryAsync";
import { DirectoryEntry, Entry, ErrorCallback, FileEntry } from "./filesystem";
import { FileSystemAsync } from "./FileSystemAsync";
import {
  CONTENT_TYPE,
  DIR_SEPARATOR,
  EMPTY_BLOB,
  LAST_DIR_SEPARATORS
} from "./FileSystemConstants";

const g: any = window || global;
if (!g.atob) {
  g.atob = decode;
}

const LAST_PATH_PART = /\/([^\/]*)$/;

function stringifyEscaped(obj: any) {
  const json = JSON.stringify(obj);
  const escaped = json.replace(/[\u007F-\uFFFF]/g, function(chr) {
    return "\\u" + ("0000" + chr.charCodeAt(0).toString(16)).substr(-4);
  });
  return escaped;
}

export function createPath(parentPath: string, name: string) {
  parentPath = parentPath.replace(LAST_DIR_SEPARATORS, "");
  return parentPath + DIR_SEPARATOR + name;
}

export function getParentPath(filePath: string) {
  const parentPath = filePath.replace(LAST_PATH_PART, "");
  return parentPath === "" ? DIR_SEPARATOR : parentPath;
}

export function getName(filePath: string) {
  const result = LAST_PATH_PART.exec(filePath);
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
    type: type || CONTENT_TYPE
  });
  return file;
}

function createFileReader(
  resolveAction: () => void,
  reject: (reason?: any) => void
) {
  const reader = new FileReader();
  const handleError = (ev: any) => reject(reader.error || ev);
  reader.onerror = handleError;
  reader.onabort = handleError;
  reader.onloadend = ev => {
    resolveAction();
  };
  return reader;
}

export async function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    if (!blob || blob.size === 0) {
      resolve("");
      return;
    }

    const reader = createFileReader(() => {
      const base64Url = reader.result as string;
      const base64 = base64Url.substr(base64Url.indexOf(",") + 1);
      resolve(base64);
    }, reject);
    setTimeout(() => {
      // for React Native bugs
      reader.readAsDataURL(blob);
    }, 0);
  });
}

export function blobToString(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = createFileReader(() => {
      resolve(reader.result as string);
    }, reject);
    setTimeout(() => {
      // for React Native bugs
      reader.readAsText(blob);
    }, 0);
  });
}

export function base64ToBlob(base64: string, type = CONTENT_TYPE) {
  if (!base64) {
    return EMPTY_BLOB;
  }

  const bin = atob(base64);
  const length = bin.length;
  const ab = new ArrayBuffer(bin.length);
  const ua = new Uint8Array(ab);
  for (var i = 0; i < length; i++) {
    ua[i] = bin.charCodeAt(i);
  }
  const blob = new Blob([ua], { type: type });
  return blob;
}

export function objectToBlob(obj: any) {
  if (!obj) {
    return EMPTY_BLOB;
  }
  const str = stringifyEscaped(obj);
  return new Blob([str], { type: "application/json; charset=utf-8" });
}

export async function blobToObject(blob: Blob) {
  if (!blob || blob.size === 0) {
    return null;
  }
  const str = await blobToString(blob);
  try {
    const obj = JSON.parse(str);
    return obj;
  } catch (e) {
    console.warn(e, str);
    return null;
  }
}

export function createEmptyFile(name: string) {
  return new File([], name, {
    lastModified: Date.now(),
    type: CONTENT_TYPE
  });
}

export function onError(err: DOMError, errorCallback?: ErrorCallback) {
  if (errorCallback) {
    errorCallback(err);
  } else {
    console.error(err);
  }
}
