import { toArrayBuffer, toBase64 } from "./BinaryConverter";
import {
  DEFAULT_CONTENT_TYPE,
  EMPTY_ARRAY_BUFFER,
  EMPTY_BLOB,
} from "./FileSystemConstants";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

async function blobToText(blob: Blob) {
  if (blob.size === 0) {
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

export async function toText(content: Blob | BufferSource | string) {
  if (!content) {
    return "";
  }

  if (typeof content === "string") {
    return content;
  }
  if (ArrayBuffer.isView(content)) {
    return textDecoder.decode(content);
  }
  if (content instanceof Blob) {
    return await blobToText(content);
  }

  throw new TypeError("Cannot convert to Text: " + content);
}

export async function base64ToText(base64: string) {
  if (!base64) {
    return "";
  }

  const buffer = await toArrayBuffer(base64);
  return toText(buffer);
}

export function textToBlob(text: string, type = DEFAULT_CONTENT_TYPE) {
  if (!text) {
    return EMPTY_BLOB;
  }

  return new Blob([text], { type });
}

export function textToArrayBuffer(text: string) {
  if (!text) {
    return EMPTY_ARRAY_BUFFER;
  }

  return textEncoder.encode(text);
}

export async function textToBase64(text: string) {
  if (!text) {
    return "";
  }

  const buffer = textEncoder.encode(text);
  return await toBase64(buffer);
}
