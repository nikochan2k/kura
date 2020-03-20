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

let sliceSize = 3 * 256; // 3 is for base64
const LAST_PATH_PART = /\/([^\/]+)\/?$/;

export function setSlizeSize(size: number) {
  if (size % 3 !== 0) {
    throw new Error("slice size should be divisible by 3");
  }
  sliceSize = size;
}

function stringifyEscaped(obj: any) {
  const json = JSON.stringify(obj);
  const escaped = json.replace(/[\u007F-\uFFFF]/g, function(chr) {
    return "\\u" + ("0000" + chr.charCodeAt(0).toString(16)).substr(-4);
  });
  return escaped;
}

export function getParentPath(filePath: string) {
  const parentPath = filePath.replace(LAST_PATH_PART, "");
  return parentPath === "" ? DIR_SEPARATOR : parentPath;
}

export function getName(filePath: string) {
  const result = LAST_PATH_PART.exec(filePath);
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
    type: type || CONTENT_TYPE
  });
  return file;
}

export function dataUriToBase64(dataUri: string) {
  const index = dataUri.indexOf(",");
  if (0 <= index) {
    return dataUri.substr(index + 1);
  }
  return dataUri;
}

export async function blobToSomething(
  blob: Blob,
  readDelegate: (reader: FileReader, sliced: Blob) => void,
  loaded: (reader: FileReader) => void
) {
  if (!blob || blob.size === 0) {
    return;
  }

  for (let from = 0, end = blob.size; from < end; from += sliceSize) {
    let to: number;
    if (from + sliceSize < end) {
      to = from + sliceSize;
    } else {
      to = end;
    }
    const sliced = blob.slice(from, to);
    const reader = new FileReader();
    await new Promise<void>((resolve, reject) => {
      reader.onerror = ev => {
        console.trace(ev);
        reject(reader.error || ev);
      };
      reader.onload = () => {
        loaded(reader);
        resolve();
      };
      readDelegate(reader, sliced);
    });
  }
}

export async function blobToBase64(blob: Blob) {
  let base64 = "";
  if (!blob || blob.size === 0) {
    return base64;
  }

  await blobToSomething(
    blob,
    (reader: FileReader, sliced: Blob) => {
      reader.readAsDataURL(sliced);
    },
    (reader: FileReader) => {
      base64 += dataUriToBase64(reader.result as string);
    }
  );
  return base64;
}

export async function blobToText(blob: Blob) {
  let text = "";
  if (!blob || blob.size === 0) {
    return text;
  }

  await blobToSomething(
    blob,
    (reader: FileReader, sliced: Blob) => {
      reader.readAsText(sliced);
    },
    (reader: FileReader) => {
      text += reader.result as string;
    }
  );
  return text;
}

export function urlToBlob(url: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onerror = e => {
      console.trace(e);
      reject(e);
    };
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        resolve(xhr.response);
      }
    };
    xhr.open("GET", url);
    xhr.responseType = "blob";
    xhr.send();
  });
}

export function base64ToBlob(base64: string, type = CONTENT_TYPE) {
  if (!base64) {
    return EMPTY_BLOB;
  }

  base64 = dataUriToBase64(base64);
  if (window && window.atob) {
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
  } else {
    try {
      var bin = decode(base64);
    } catch (e) {
      console.trace(e, base64);
    }
    const blob = new Blob([bin], { type: type });
    return blob;
  }
}

export function objectToBlob(obj: any) {
  if (!obj) {
    return EMPTY_BLOB;
  }
  const str = stringifyEscaped(obj);
  return new Blob([str], { type: "application/json" });
}

export async function blobToObject(blob: Blob) {
  if (!blob || blob.size === 0) {
    return null;
  }
  const str = await blobToText(blob);
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
