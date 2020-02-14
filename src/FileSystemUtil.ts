import { decode } from "base-64";
import { DirectoryEntryAsync } from "./DirectoryEntryAsync";
import { FileEntryAsync } from "./FileEntryAsync";
import { DirectoryEntry, Entry, ErrorCallback, FileEntry } from "./filesystem";
import { FileSystemAsync } from "./FileSystemAsync";
import { CONTENT_TYPE, DIR_SEPARATOR, EMPTY_BLOB } from "./FileSystemConstants";

const g: any = window || global;
if (!g.atob) {
  g.atob = decode;
}

const LastPathPart = /\/([^\/]*)$/;

export function createPath(parentPath: string, name: string) {
  if (parentPath === DIR_SEPARATOR) {
    return parentPath + name;
  } else {
    return parentPath + DIR_SEPARATOR + name;
  }
}

export function getParentPath(filePath: string) {
  const parentPath = filePath.replace(LastPathPart, "");
  return parentPath === "" ? DIR_SEPARATOR : parentPath;
}

export function getName(filePath: string) {
  const result = LastPathPart.exec(filePath);
  return result[1];
}

export function createEntry(fileSystemAsync: FileSystemAsync, entry: Entry) {
  return entry.isFile
    ? new FileEntryAsync(fileSystemAsync, entry as FileEntry)
    : new DirectoryEntryAsync(fileSystemAsync, entry as DirectoryEntry);
}

export function resolveToFullPath(cwdFullPath: string, path: string) {
  let fullPath = path;

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

export async function blobToArrayBuffer(blob: Blob) {
  return new Promise<ArrayBuffer>(resolve => {
    if (!blob || blob.size === 0) {
      resolve(new ArrayBuffer(0));
      return;
    }

    const reader = new FileReader();
    reader.onloadend = function() {
      const buffer = reader.result as ArrayBuffer;
      resolve(buffer);
    };
    reader.readAsArrayBuffer(blob);
  });
}

export async function blobToBase64(blob: Blob) {
  return new Promise<string>(resolve => {
    if (!blob || blob.size === 0) {
      resolve("");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = function() {
      const base64Url = reader.result as string;
      const base64 = base64Url.substr(base64Url.indexOf(",") + 1);
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

export function blobToString(blob: Blob) {
  return new Promise<string>(resolve => {
    const reader = new FileReader();
    reader.addEventListener("loadend", e => {
      const str = (e.srcElement as FileReader).result as string;
      resolve(str);
    });
    reader.readAsText(blob);
  });
}

export function base64ToBlob(base64: string, type = CONTENT_TYPE) {
  if (!base64) {
    return EMPTY_BLOB;
  }

  const bin = atob(base64);
  const array = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    array[i] = bin.charCodeAt(i);
  }
  const blob = new Blob([array.buffer], { type: type });
  return blob;
}

export function objectToBlob(obj: any) {
  if (!obj) {
    return EMPTY_BLOB;
  }
  const str = JSON.stringify(obj);
  return new Blob([str], { type: "application/json" });
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

export function toArrayBuffer(
  blob: Blob,
  onload: (result: ArrayBuffer) => void
) {
  const reader = new FileReader();
  reader.onloadend = function() {
    onload(reader.result as ArrayBuffer);
  };
  reader.readAsArrayBuffer(blob);
}

export function onError(err: DOMError, errorCallback?: ErrorCallback) {
  if (errorCallback) {
    errorCallback(err);
  } else {
    console.error(err);
  }
}
