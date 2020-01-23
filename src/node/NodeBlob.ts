// Based on https://github.com/tmpvar/jsdom/blob/aa85b2abf07766ff7bf5c1f6daafb3726f2f2db5/lib/jsdom/living/blob.js
// (MIT licensed)

export class NodeBlob implements Blob {
  private buffer: Buffer;
  type = "";

  constructor(blobParts?: BlobPart[], options?: BlobPropertyBag) {
    const buffers: Uint8Array[] = [];
    if (blobParts) {
      blobParts.forEach(element => {
        let buffer;
        if (element instanceof Buffer) {
          buffer = element;
        } else if (ArrayBuffer.isView(element)) {
          buffer = Buffer.from(
            element.buffer,
            element.byteOffset,
            element.byteLength
          );
        } else if (element instanceof ArrayBuffer) {
          buffer = Buffer.from(element);
        } else if (element instanceof NodeBlob) {
          buffer = element.buffer;
        } else {
          buffer = Buffer.from(
            typeof element === "string" ? element : String(element)
          );
        }

        buffers.push(buffer);
      });
    }

    this.buffer = Buffer.concat(buffers);

    const type =
      options &&
      options.type !== undefined &&
      String(options.type).toLowerCase();
    if (type && !/[^\u0020-\u007E]/.test(type)) {
      this.type = type;
    }
  }

  get size() {
    return this.buffer.length;
  }

  slice(start?: number, end?: number, contentType?: string) {
    const size = this.size;

    let relativeStart: number;
    if (start == null) {
      relativeStart = 0;
    } else if (start < 0) {
      relativeStart = Math.max(size + start, 0);
    } else {
      relativeStart = Math.min(start, size);
    }

    let relativeEnd: number;
    if (end == null) {
      relativeEnd = size;
    } else if (end < 0) {
      relativeEnd = Math.max(size + end, 0);
    } else {
      relativeEnd = Math.min(end, size);
    }

    const span = Math.max(relativeEnd - relativeStart, 0);

    const buffer = this.buffer;
    const slicedBuffer = buffer.slice(relativeStart, relativeStart + span);
    const blob = new NodeBlob([], { type: contentType });
    blob.buffer = slicedBuffer;
    return blob;
  }
}
