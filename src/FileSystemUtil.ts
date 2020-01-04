import { DIR_SEPARATOR } from "./FileSystemConstants";
import { DirectoryEntry, Entry, ErrorCallback, FileEntry } from "./filesystem";
import { DirectoryEntryAsync } from "./DirectoryEntryAsync";
import { FileEntryAsync } from "./FileEntryAsync";
import { FileSystemAsync } from "./FileSystemAsync";

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
    type: type || "application/octet-stream"
  });
  return file;
}

export function base64ToFile(
  base64: string,
  name: string,
  lastModified: number
) {
  const bin = atob(base64);
  const array = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    array[i] = bin.charCodeAt(i);
  }
  const file = new File([array.buffer], name, {
    lastModified: lastModified,
    type: "application/octet-stream"
  });
  return file;
}

export function createEmptyFile(name: string) {
  return new File([], name, {
    lastModified: Date.now(),
    type: "application/octet-stream"
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
