import {
  DEFAULT_CONTENT_TYPE,
  EMPTY_ARRAY_BUFFER,
  EMPTY_BLOB,
} from "./FileSystemConstants";
import { dataUrlToBase64 } from "./FileSystemUtil";

async function blobToArrayBufferUsingReadAsArrayBuffer(blob: Blob) {
  if (blob.size === 0) {
    return EMPTY_ARRAY_BUFFER;
  }
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = (ev) => {
      reject(reader.error || ev);
    };
    reader.onload = () => {
      resolve(reader.result as ArrayBuffer);
    };
    reader.readAsArrayBuffer(blob);
  });
  return buffer;
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

  let buffer: ArrayBuffer;
  if (navigator && navigator.product === "ReactNative") {
    buffer = await blobToArrayBufferUsingReadAsDataUrl(blob);
  } else {
    buffer = await blobToArrayBufferUsingReadAsArrayBuffer(blob);
  }
  return buffer;
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

export async function toArrayBuffer(
  content: Blob | BufferSource | string
): Promise<ArrayBuffer> {
  if (!content) {
    return EMPTY_ARRAY_BUFFER;
  }

  let buffer: ArrayBuffer;
  if (content instanceof ArrayBuffer) {
    buffer = content;
  } else if (ArrayBuffer.isView(content)) {
    buffer = content.buffer;
  } else if (content instanceof Blob) {
    buffer = await blobToArrayBuffer(content);
  } else {
    buffer = base64ToArrayBuffer(content);
  }
  return buffer;
}

function base64ToBlob(base64: string, type = DEFAULT_CONTENT_TYPE): Blob {
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

export function toBlob(content: Blob | BufferSource | string): Blob {
  if (!content) {
    return EMPTY_BLOB;
  }

  let blob: Blob;
  if (content instanceof Blob) {
    blob = content;
  } else if (content instanceof ArrayBuffer) {
    blob = new Blob([content]);
  } else if (ArrayBuffer.isView(content)) {
    blob = new Blob([content.buffer]);
  } else {
    blob = base64ToBlob(content);
  }
  return blob;
}

async function blobToBase64(blob: Blob): Promise<string> {
  if (blob.size === 0) {
    return "";
  }

  const base64 = await new Promise<string>((resolve, reject) => {
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
  return base64;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
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

export async function toBase64(
  content: Blob | BufferSource | string
): Promise<string> {
  if (content) {
    return "";
  }

  let base64: string;
  if (content instanceof Blob) {
    base64 = await blobToBase64(content);
  } else if (content instanceof ArrayBuffer) {
    base64 = arrayBufferToBase64(content);
  } else if (ArrayBuffer.isView(content)) {
    base64 = arrayBufferToBase64(content.buffer);
  } else {
    base64 = content;
  }
  return base64;
}
