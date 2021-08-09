import * as ba from "base64-arraybuffer";
import {
  DEFAULT_BLOB_PROPS,
  DEFAULT_CONTENT_TYPE,
} from "./FileSystemConstants";
import { dataUrlToBase64 } from "./FileSystemUtil";

const CHUNK_SIZE = 96 * 1024;

async function decode(str: string) {
  return ba.decode(str);
}

async function encode(buffer: ArrayBuffer) {
  return ba.encode(buffer);
}

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

async function concatArrayBuffers(chunks: ArrayBuffer[], byteLength: number) {
  const u8 = new Uint8Array(byteLength);
  let pos = 0;
  for (const chunk of chunks) {
    u8.set(new Uint8Array(chunk), pos);
    pos += chunk.byteLength;
  }
  return u8.buffer;
}

async function blobToArrayBufferUsingReadAsArrayBuffer(blob: Blob) {
  if (blob.size === 0) {
    return new ArrayBuffer(0);
  }

  let byteLength = 0;
  const chunks: ArrayBuffer[] = [];
  for (let start = 0, end = blob.size; start < end; start += CHUNK_SIZE) {
    const blobChunk = blob.slice(start, start + CHUNK_SIZE);
    const chunk = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = (ev) => {
        reject(reader.error || ev);
      };
      reader.onload = () => {
        const chunk = reader.result as ArrayBuffer;
        byteLength += chunk.byteLength;
        resolve(chunk);
      };
      reader.readAsArrayBuffer(blobChunk);
    });
    chunks.push(chunk);
  }

  return concatArrayBuffers(chunks, byteLength);
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
  if (navigator && navigator.product === "ReactNative") {
    buffer = await blobToArrayBufferUsingReadAsDataUrl(blob);
  } else {
    buffer = await blobToArrayBufferUsingReadAsArrayBuffer(blob);
  }
  return buffer;
}

async function base64ToBuf(base64: string) {
  return Buffer.from(base64, "base64");
}

async function base64ToBuffer(base64: string) {
  const chunks: Buffer[] = [];
  let byteLength = 0;
  for (let start = 0, end = base64.length; start < end; start += CHUNK_SIZE) {
    const base64chunk = base64.substr(start, CHUNK_SIZE);
    const chunk = await base64ToBuf(base64chunk);
    byteLength += chunk.byteLength;
    chunks.push(chunk);
  }

  const buffer = Buffer.alloc(byteLength);
  let pos = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, pos);
    pos += chunk.byteLength;
  }
  return buffer;
}

async function base64ToArrayBuffer(base64: string) {
  let byteLength = 0;
  const chunks: ArrayBuffer[] = [];
  for (let start = 0, end = base64.length; start < end; start += CHUNK_SIZE) {
    const base64chunk = base64.substr(start, CHUNK_SIZE);
    const chunk = await decode(base64chunk);
    byteLength += chunk.byteLength;
    chunks.push(chunk);
  }
  return concatArrayBuffers(chunks, byteLength);
}

async function uint8ArrayToArrayBuffer(view: Uint8Array) {
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
    buffer = await base64ToBuffer(content);
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
    buffer = await base64ToArrayBuffer(content);
  } else if (isBlob(content)) {
    buffer = await blobToArrayBuffer(content);
  } else if (isBuffer(content)) {
    buffer = content.buffer.slice(
      content.byteOffset,
      content.byteOffset + content.byteLength
    );
  } else if (ArrayBuffer.isView(content)) {
    buffer = await uint8ArrayToArrayBuffer(content as Uint8Array);
  } else {
    buffer = content;
  }
  return buffer;
}

async function base64ToBlob(
  base64: string,
  type = DEFAULT_CONTENT_TYPE
): Promise<Blob> {
  try {
    const buffer = await base64ToArrayBuffer(base64);
    return new Blob([buffer], { type });
  } catch (e) {
    console.warn(e, base64);
    return new Blob([], DEFAULT_BLOB_PROPS);
  }
}

export async function toBlob(
  content: Blob | BufferSource | string
): Promise<Blob> {
  if (!content) {
    return new Blob([], DEFAULT_BLOB_PROPS);
  }

  let blob: Blob;
  if (typeof content === "string") {
    blob = await base64ToBlob(content);
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

  const chunks: string[] = [];
  for (let start = 0, end = blob.size; start < end; start += CHUNK_SIZE) {
    const blobChunk = blob.slice(start, start + CHUNK_SIZE);
    const chunk = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = function (ev) {
        reject(reader.error || ev);
      };
      reader.onload = function () {
        const base64 = dataUrlToBase64(reader.result as string);
        resolve(base64);
      };
      reader.readAsDataURL(blobChunk);
    });
    chunks.push(chunk);
  }
  return chunks.join("");
}

async function arrayBufferToBase64(ab: ArrayBuffer): Promise<string> {
  return encode(ab);
}

async function uint8ArrayToBase64(u8: Uint8Array): Promise<string> {
  const chunks: string[] = [];
  for (let start = 0, end = u8.byteLength; start < end; start += CHUNK_SIZE) {
    const u8Chunk = u8.slice(start, start + CHUNK_SIZE);
    const abChunk = await uint8ArrayToArrayBuffer(u8Chunk);
    const chunk = await arrayBufferToBase64(abChunk);
    chunks.push(chunk);
  }
  const base64 = chunks.join("");
  return base64;
}

async function bufferToBase64(buffer: Buffer) {
  const chunks: string[] = [];
  for (
    let start = 0, end = buffer.byteLength;
    start < end;
    start += CHUNK_SIZE
  ) {
    const bufferChunk = buffer.slice(start, start + CHUNK_SIZE);
    const chunk = bufferChunk.toString("base64");
    chunks.push(chunk);
  }
  const base64 = chunks.join("");
  return base64;
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
    base64 = await bufferToBase64(content);
  } else if (ArrayBuffer.isView(content)) {
    base64 = await uint8ArrayToBase64(content as Uint8Array);
  } else {
    base64 = await uint8ArrayToBase64(new Uint8Array(content));
  }
  return base64;
}
