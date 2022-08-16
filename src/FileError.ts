export interface FileError {
  code: number;
}

export abstract class AbstractFileError implements FileError {
  public abstract code: number;
  public e: any;
  public fullPath: string;
  public key: string;
  public abstract name: string;
  public stack: string;

  constructor(key: string, fullPath: string, e?: any) {
    this.key = key;
    this.fullPath = fullPath;
    if (e instanceof Error) {
      this.e = e.name + ", " + e.message;
      this.stack = e.stack;
    } else {
      this.e = e;
      this.stack = new Error().stack;
    }
  }
}

export class NotFoundError extends AbstractFileError {
  public code = 1;
  public name = "Not found error";

  constructor(key: string, fullPath: string, detail?: any) {
    super(key, fullPath, detail);
  }
}

export class NotReadableError extends AbstractFileError {
  public code = 1;
  public name = "Not readable error";

  constructor(key: string, fullPath: string, detail?: any) {
    super(key, fullPath, detail);
  }
}

export class NoModificationAllowedError extends AbstractFileError {
  public code = 6;
  public name = "No modification allowed error";

  constructor(key: string, fullPath: string, detail?: any) {
    super(key, fullPath, detail);
  }
}

export class InvalidStateError extends AbstractFileError {
  public code = 7;
  public name = "Invalid state error";

  constructor(key: string, fullPath: string, detail?: any) {
    super(key, fullPath, detail);
  }
}

export class InvalidModificationError extends AbstractFileError {
  public code = 9;
  public name = "Invalid modification error";

  constructor(key: string, fullPath: string, detail?: any) {
    super(key, fullPath, detail);
  }
}

export class PathExistsError extends AbstractFileError {
  public code = 12;
  public name = "Path exists error";

  constructor(key: string, fullPath: string, detail?: any) {
    super(key, fullPath, detail);
  }
}

export class NotImplementedError extends AbstractFileError {
  public code = -1;
  public name = "Not implemented";

  constructor(key: string, fullPath: string, detail?: any) {
    super(key, fullPath, detail);
  }
}
