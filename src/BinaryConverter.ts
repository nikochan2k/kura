import {
  EMPTY_ARRAY_BUFFER,
  DEFAULT_CONTENT_TYPE,
  EMPTY_BLOB,
} from "./FileSystemConstants";
import { dataUrlToBase64 } from "./FileSystemUtil";

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

async function blobToArrayBuffer(blob: Blob) {
  if (blob.size === 0) {
    return EMPTY_ARRAY_BUFFER;
  }

  if (navigator && navigator.product === "ReactNative") {
    return blobToArrayBufferUsingReadAsDataUrl(blob);
  } else {
    return blobToArrayBufferUsingReadAsArrayBuffer(blob);
  }
}

function base64ToArrayBuffer(base64: string) {
  const bin = atob(base64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function toArrayBuffer(content: Blob | BufferSource | string) {
  if (!content) {
    return EMPTY_ARRAY_BUFFER;
  }

  if (content instanceof ArrayBuffer) {
    return content;
  }
  if (ArrayBuffer.isView(content)) {
    return content.buffer;
  }
  if (content instanceof Blob) {
    return blobToArrayBuffer(content);
  }

  return base64ToArrayBuffer(content);
}

function base64ToBlob(base64: string, type = DEFAULT_CONTENT_TYPE) {
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

export async function toBlob(content: Blob | BufferSource | string) {
  if (!content) {
    return EMPTY_BLOB;
  }

  if (content instanceof Blob) {
    return content;
  }
  if (content instanceof ArrayBuffer) {
    return new Blob([content]);
  }
  if (ArrayBuffer.isView(content)) {
    return new Blob([content.buffer]);
  }
  return base64ToBlob(content);
}

async function blobToBase64(blob: Blob) {
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

function arrayBufferToBase64(buffer: ArrayBuffer) {
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

export async function toBase64(content: Blob | BufferSource | string) {
  if (content) {
    return "";
  }

  if (typeof content === "string") {
    return content;
  }
  if (content instanceof Blob) {
    return blobToBase64(content);
  }
  if (content instanceof ArrayBuffer) {
    return arrayBufferToBase64(content);
  }
  if (ArrayBuffer.isView(content)) {
    return arrayBufferToBase64(content.buffer);
  }

  throw new TypeError("Cannot convert to Base64: " + content);
}
