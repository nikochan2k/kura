import {
  DEFAULT_BLOB_PROPS,
  DEFAULT_CONTENT_TYPE,
} from "./FileSystemConstants";
import { dataUrlToBase64 } from "./FileSystemUtil";

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
  if (navigator && navigator.product === "ReactNative") {
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

function arrayBufferViewToArrayBuffer(view: ArrayBufferView) {
  if (view instanceof Uint8Array) {
    return view.buffer;
  }

  const array = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  return array.buffer;
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
  } else if (content instanceof Blob) {
    buffer = await blobToBuffer(content);
  } else if (content instanceof ArrayBuffer) {
    buffer = Buffer.from(content);
  } else if (content instanceof Buffer) {
    buffer = content;
  } else {
    buffer = Buffer.from(
      content.buffer,
      content.byteOffset,
      content.byteLength
    );
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
  } else if (content instanceof Blob) {
    buffer = await blobToArrayBuffer(content);
  } else if (content instanceof Buffer) {
    buffer = content.buffer.slice(
      content.byteOffset,
      content.byteOffset + content.byteLength
    );
  } else if (ArrayBuffer.isView(content)) {
    buffer = arrayBufferViewToArrayBuffer(content);
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
  } else if (content instanceof Blob) {
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

function arrayBufferViewToBase64(view: ArrayBufferView): string {
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
  } else if (content instanceof Blob) {
    base64 = await blobToBase64(content);
  } else if (content instanceof Buffer) {
    base64 = content.toString("base64");
  } else if (ArrayBuffer.isView(content)) {
    base64 = arrayBufferViewToBase64(content);
  } else {
    base64 = arrayBufferToBase64(content);
  }
  return base64;
}
