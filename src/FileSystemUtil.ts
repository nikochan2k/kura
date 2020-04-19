import { DirectoryEntryAsync } from "./DirectoryEntryAsync";
import { FileEntryAsync } from "./FileEntryAsync";
import { DirectoryEntry, Entry, ErrorCallback, FileEntry } from "./filesystem";
import { FileSystemAsync } from "./FileSystemAsync";
import {
  CONTENT_TYPE,
  DIR_SEPARATOR,
  EMPTY_ARRAY_BUFFER,
  EMPTY_BLOB,
  LAST_DIR_SEPARATORS,
} from "./FileSystemConstants";

let chunkSize = 3 * 256 * 1024; // 3 is for base64
const LAST_PATH_PART = /\/([^\/]+)\/?$/;

export function setChunkSize(size: number) {
  if (size % 3 !== 0) {
    throw new Error("slice size should be divisible by 3");
  }
  chunkSize = size;
}

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
    type: type || CONTENT_TYPE,
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

async function blobToArrayBufferUsingReadAsArrayBuffer(blob: Blob) {
  if (blob.size === 0) {
    return EMPTY_ARRAY_BUFFER;
  }
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = (ev) => {
      reject(reader.error || ev);
    };
    reader.onload = () => {
      resolve(reader.result as ArrayBuffer);
    };
    reader.readAsArrayBuffer(blob);
  });
}

async function blobToArrayBufferUsingReadAsDataUrl(blob: Blob) {
  const base64 = await blobToBase64(blob);
  if (!base64) {
    return EMPTY_ARRAY_BUFFER;
  }

  const buffer = new ArrayBuffer(blob.size);
  const view = new Uint8Array(buffer);
  const content = atob(base64);
  view.set(Array.from(content).map((c) => c.charCodeAt(0)));
  return buffer;
}

export async function blobToArrayBuffer(blob: Blob) {
  if (blob.size === 0) {
    return EMPTY_ARRAY_BUFFER;
  }

  if (navigator && navigator.product === "ReactNative") {
    return blobToArrayBufferUsingReadAsDataUrl(blob);
  } else {
    return blobToArrayBufferUsingReadAsArrayBuffer(blob);
  }
}

export async function blobToBase64(blob: Blob) {
  if (blob.size === 0) {
    return "";
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = function (ev) {
      reject(reader.error || ev);
    };
    reader.onload = function () {
      const base64 = dataUrlToBase64(reader.result as string);
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

export function arrayBufferToBase64(buffer: ArrayBuffer) {
  if (buffer.byteLength === 0) {
    return "";
  }

  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (var i = 0, end = bytes.byteLength; i < end; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function arrayBufferToBlob(buffer: ArrayBuffer) {
  if (buffer.byteLength === 0) {
    return EMPTY_BLOB;
  }

  return new Blob([new Uint8Array(buffer)]);
}

export async function blobToText(blob: Blob) {
  if (!blob || blob.size === 0) {
    return "";
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = (ev) => {
      reject(reader.error || ev);
    };
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.readAsText(blob);
  });
}

export function base64ToArrayBuffer(base64: string) {
  const bin = atob(base64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes.buffer;
}

export function base64ToBlob(base64: string, type = CONTENT_TYPE) {
  if (!base64) {
    return EMPTY_BLOB;
  }

  try {
    var bin = atob(base64);
  } catch (e) {
    console.trace(e, base64);
    return EMPTY_BLOB;
  }
  const length = bin.length;
  const ab = new ArrayBuffer(bin.length);
  const ua = new Uint8Array(ab);
  for (var i = 0; i < length; i++) {
    ua[i] = bin.charCodeAt(i);
  }
  const blob = new Blob([ua], { type: type });
  return blob;
}

export function textToObject(text: string) {
  try {
    const obj = JSON.parse(text);
    return obj;
  } catch (e) {
    console.warn(e, text);
    return null;
  }
}

export function createEmptyFile(name: string) {
  return new File([], name, {
    lastModified: Date.now(),
    type: CONTENT_TYPE,
  });
}

export function objectToText(obj: any) {
  return JSON.stringify(obj);
}

export function getSize(content: Blob | ArrayBuffer | string) {
  if (!content) {
    return 0;
  }

  let size: number;
  if (content instanceof Blob) {
    size = content.size;
  } else if (content instanceof ArrayBuffer) {
    size = content.byteLength;
  } else {
    size = Math.floor(content.replace(/=/g, "").length * 0.75); // Base64
  }
  return size;
}

export function getTextSize(text: string) {
  return encodeURIComponent(text).replace(/%../g, "x").length; // UTF-8
}

export function onError(err: DOMError, errorCallback?: ErrorCallback) {
  if (errorCallback) {
    errorCallback(err);
  } else {
    console.error(err);
  }
}
