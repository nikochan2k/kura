import { toArrayBuffer, toBase64 } from "./BinaryConverter";
import {
  DEFAULT_CONTENT_TYPE,
  EMPTY_ARRAY_BUFFER,
  EMPTY_BLOB,
} from "./FileSystemConstants";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

async function blobToText(blob: Blob): Promise<string> {
  if (blob.size === 0) {
    return "";
  }

  const text = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = (ev) => {
      reject(reader.error || ev);
    };
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.readAsText(blob);
  });
  return text;
}

export async function toText(
  content: Blob | Uint8Array | ArrayBuffer | string
): Promise<string> {
  if (!content) {
    return "";
  }

  let text: string;
  if (typeof content === "string") {
    text = await base64ToText(content);
  } else if (content instanceof Blob) {
    text = await blobToText(content);
  } else if (ArrayBuffer.isView(content)) {
    text = textDecoder.decode(content);
  } else {
    text = textDecoder.decode(new Uint8Array(content));
  }
  return text;
}

export async function base64ToText(base64: string): Promise<string> {
  if (!base64) {
    return "";
  }

  const buffer = await toArrayBuffer(base64);
  const text = await toText(buffer);
  return text;
}

export function textToBlob(text: string, type = DEFAULT_CONTENT_TYPE): Blob {
  if (!text) {
    return EMPTY_BLOB;
  }

  return new Blob([text], { type });
}

export function textToArrayBuffer(text: string): ArrayBuffer {
  if (!text) {
    return EMPTY_ARRAY_BUFFER;
  }

  const view = textEncoder.encode(text);
  return view;
}

export async function textToBase64(text: string): Promise<string> {
  if (!text) {
    return "";
  }

  const buffer = textEncoder.encode(text);
  const base64 = await toBase64(buffer);
  return base64;
}
