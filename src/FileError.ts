export interface FileError extends DOMError {
  code: number;
}

export abstract class AbstractFileError implements FileError {
  abstract code: number;
  abstract name: string;
  stack: string;

  constructor(
    public key: string,
    public filePath: string,
    public detail?: string
  ) {
    this.stack = new Error().stack;
  }
}

export class InvalidStateError extends AbstractFileError {
  code = 7;
  name = "Invalid state error";

  constructor(key: string, filePath: string, detail?: string) {
    super(key, filePath, detail);
  }
}

export class InvalidModificationError extends AbstractFileError {
  code = 9;
  name = "Invalid modification error";

  constructor(key: string, filePath: string, detail?: string) {
    super(key, filePath, detail);
  }
}

export class NotFoundError extends AbstractFileError {
  code = 1;
  name = "Not found";

  constructor(key: string, filePath: string, detail?: string) {
    super(key, filePath, detail);
  }
}

export class NotImplementedError extends AbstractFileError {
  code = -1;
  name = "Not implemented";

  constructor(key: string, filePath: string, detail?: string) {
    super(key, filePath, detail);
  }
}
