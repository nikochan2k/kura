import { NodeBlob } from "./NodeBlob";

export class NodeFile extends NodeBlob implements File {
  constructor(
    fileBits: BlobPart[],
    fileName: string,
    options?: FilePropertyBag
  ) {
    super(fileBits, options);
    this.name = fileName;
    this.lastModified = options.lastModified;
  }

  lastModified: number;
  name: string;
}
