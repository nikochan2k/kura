export interface FileError extends DOMError {
  code: number;
}

export abstract class AbstractFileError implements FileError {
  abstract name: string;
  abstract code: number;
  stack: string;
  constructor(
    public bucket: string,
    public filePath: string,
    public detail?: string
  ) {
    this.stack = new Error().stack;
  }
}

export class InvalidStateError extends AbstractFileError {
  constructor(bucket: string, filePath: string, detail?: string) {
    super(bucket, filePath, detail);
  }
  name = "Invalid state error";
  code = 7;
}

export class InvalidModificationError extends AbstractFileError {
  constructor(bucket: string, filePath: string, detail?: string) {
    super(bucket, filePath, detail);
  }
  name = "Invalid modification error";
  code = 9;
}

export class NotFoundError extends AbstractFileError {
  constructor(bucket: string, filePath: string, detail?: string) {
    super(bucket, filePath, detail);
  }
  name = "Not found";
  code = 1;
}

export class NotImplementedError extends AbstractFileError {
  constructor(bucket: string, filePath: string, detail?: string) {
    super(bucket, filePath, detail);
  }
  name = "Not implemented";
  code = -1;
}
