export interface FileError extends DOMError {
  code: number;
}

export abstract class AbstractFileError implements FileError {
  abstract code: number;
  e: any;
  fullPath: string;
  key: string;
  abstract name: string;

  constructor(key: string, fullPath: string, e?: any) {
    this.key = key;
    this.fullPath = fullPath;
    this.e = e;
    if (e) {
      console.warn(e);
    }
  }
}

export class NotFoundError extends AbstractFileError {
  code = 1;
  name = "Not found error";

  constructor(key: string, fullPath: string, detail?: any) {
    super(key, fullPath, detail);
  }
}

export class NotReadableError extends AbstractFileError {
  code = 1;
  name = "Not readable error";

  constructor(key: string, fullPath: string, detail?: any) {
    super(key, fullPath, detail);
  }
}

export class NoModificationAllowedError extends AbstractFileError {
  code = 6;
  name = "No modification allowed error";

  constructor(key: string, fullPath: string, detail?: any) {
    super(key, fullPath, detail);
  }
}

export class InvalidStateError extends AbstractFileError {
  code = 7;
  name = "Invalid state error";

  constructor(key: string, fullPath: string, detail?: any) {
    super(key, fullPath, detail);
  }
}

export class InvalidModificationError extends AbstractFileError {
  code = 9;
  name = "Invalid modification error";

  constructor(key: string, fullPath: string, detail?: any) {
    super(key, fullPath, detail);
  }
}

export class PathExistsError extends AbstractFileError {
  code = 12;
  name = "Path exists error";

  constructor(key: string, fullPath: string, detail?: any) {
    super(key, fullPath, detail);
  }
}

export class NotImplementedError extends AbstractFileError {
  code = -1;
  name = "Not implemented";

  constructor(key: string, fullPath: string, detail?: any) {
    super(key, fullPath, detail);
  }
}
