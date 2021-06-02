import {
  DEFAULT_BLOB_PROPS,
  DEFAULT_CONTENT_TYPE,
} from "./FileSystemConstants";
import { dataUrlToBase64 } from "./FileSystemUtil";
import { isReactNative } from "./Util";

const { toString } = Object.prototype;

export function isBlob(value: unknown): value is Blob {
  return value instanceof Blob || toString.call(value) === "[object Blob]";
}

export function isUint8Array(value: unknown): value is Uint8Array {
  return (
    value instanceof Uint8Array ||
    toString.call(value) === "[object Uint8Array]"
  );
}

export function isBuffer(value: any): value is Buffer {
  return (
    typeof value?.constructor?.isBuffer === "function" &&
    value.constructor.isBuffer(value)
  );
}

async function blobToArrayBufferUsingReadAsArrayBuffer(blob: Blob) {
  if (blob.size === 0) {
    return new ArrayBuffer(0);
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
    return new ArrayBuffer(0);
  }

  return base64ToArrayBuffer(base64);
}

async function blobToBuffer(blob: Blob) {
  const arrayBuffer = await blobToArrayBuffer(blob);
  return Buffer.from(arrayBuffer);
}

async function blobToArrayBuffer(blob: Blob) {
  if (blob.size === 0) {
    return new ArrayBuffer(0);
  }

  let buffer: ArrayBuffer;
  if (isReactNative) {
    buffer = await blobToArrayBufferUsingReadAsDataUrl(blob);
  } else {
    buffer = await blobToArrayBufferUsingReadAsArrayBuffer(blob);
  }
  return buffer;
}

function base64ToBuffer(base64: string) {
  return Buffer.from(base64, "base64");
}

function base64ToArrayBuffer(base64: string) {
  const buffer = base64ToBuffer(base64);
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  );
  return arrayBuffer;
}

function uint8ArrayToArrayBuffer(view: Uint8Array) {
  const viewLength = view.length;
  const buffer = view.buffer;
  if (viewLength === buffer.byteLength) {
    return buffer;
  }

  const newBuffer = new ArrayBuffer(viewLength);
  const newView = new Uint8Array(newBuffer);
  for (let i = 0; i < viewLength; i++) {
    newView[i] = view[i];
  }
  return newBuffer;
}

export async function toBuffer(
  content: Blob | BufferSource | string
): Promise<Buffer> {
  if (!content) {
    return Buffer.from([]);
  }

  let buffer: Buffer;
  if (typeof content === "string") {
    buffer = base64ToBuffer(content);
  } else if (isBlob(content)) {
    buffer = await blobToBuffer(content);
  } else if (isBuffer(content)) {
    buffer = content;
  } else if (ArrayBuffer.isView(content)) {
    buffer = Buffer.from(
      content.buffer,
      content.byteOffset,
      content.byteLength
    );
  } else {
    buffer = Buffer.from(content);
  }
  return buffer;
}

export async function toArrayBuffer(
  content: Blob | BufferSource | string
): Promise<ArrayBuffer> {
  if (!content) {
    return new ArrayBuffer(0);
  }

  let buffer: ArrayBuffer;
  if (typeof content === "string") {
    buffer = base64ToArrayBuffer(content);
  } else if (isBlob(content)) {
    buffer = await blobToArrayBuffer(content);
  } else if (isBuffer(content)) {
    buffer = content.buffer.slice(
      content.byteOffset,
      content.byteOffset + content.byteLength
    );
  } else if (ArrayBuffer.isView(content)) {
    buffer = uint8ArrayToArrayBuffer(content as Uint8Array);
  } else {
    buffer = content;
  }
  return buffer;
}

function base64ToBlob(base64: string, type = DEFAULT_CONTENT_TYPE): Blob {
  try {
    const buffer = base64ToBuffer(base64);
    return new Blob([buffer]);
  } catch (e) {
    console.warn(e, base64);
    return new Blob([], DEFAULT_BLOB_PROPS);
  }
}

export function toBlob(content: Blob | BufferSource | string): Blob {
  if (!content) {
    return new Blob([], DEFAULT_BLOB_PROPS);
  }

  let blob: Blob;
  if (typeof content === "string") {
    blob = base64ToBlob(content);
  } else if (isBlob(content)) {
    blob = content;
  } else {
    blob = new Blob([content]);
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

function uint8ArrayToBase64(view: Uint8Array): string {
  if (view.byteLength === 0) {
    return "";
  }

  const buffer = Buffer.from(view.buffer, view.byteOffset, view.byteLength);
  return buffer.toString("base64");
}

function arrayBufferToBase64(arrayBuffer: ArrayBuffer): string {
  if (arrayBuffer.byteLength === 0) {
    return "";
  }

  const buffer = Buffer.from(arrayBuffer);
  return buffer.toString("base64");
}

export async function toBase64(
  content: Blob | BufferSource | string
): Promise<string> {
  if (!content) {
    return "";
  }

  let base64: string;
  if (typeof content === "string") {
    base64 = content;
  } else if (isBlob(content)) {
    base64 = await blobToBase64(content);
  } else if (isBuffer(content)) {
    base64 = content.toString("base64");
  } else if (ArrayBuffer.isView(content)) {
    base64 = uint8ArrayToBase64(content as Uint8Array);
  } else {
    base64 = arrayBufferToBase64(content);
  }
  return base64;
}
