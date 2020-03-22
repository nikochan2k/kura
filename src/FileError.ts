export interface FileError extends DOMError {
  code: number;
}

export abstract class AbstractFileError implements FileError {
  private _detail: string;
  private e: any;

  abstract code: number;
  filePath: string;
  key: string;
  abstract name: string;

  constructor(key: string, filePath: string, e?: any) {
    this.key = key;
    this.filePath = filePath;
    this.e = e;
  }

  get detail(): string {
    if (!this.e) {
      return "";
    }
    if (!this._detail) {
      this._detail = JSON.stringify(this.e, null, 2);
    }
    return this._detail;
  }
}

export class NotFoundError extends AbstractFileError {
  code = 1;
  name = "Not found error";

  constructor(key: string, filePath: string, detail?: any) {
    super(key, filePath, detail);
  }
}

export class NotReadableError extends AbstractFileError {
  code = 1;
  name = "Not readable error";

  constructor(key: string, filePath: string, detail?: any) {
    super(key, filePath, detail);
  }
}

export class NoModificationAllowedError extends AbstractFileError {
  code = 6;
  name = "No modification allowed error";

  constructor(key: string, filePath: string, detail?: any) {
    super(key, filePath, detail);
  }
}

export class InvalidStateError extends AbstractFileError {
  code = 7;
  name = "Invalid state error";

  constructor(key: string, filePath: string, detail?: any) {
    super(key, filePath, detail);
  }
}

export class InvalidModificationError extends AbstractFileError {
  code = 9;
  name = "Invalid modification error";

  constructor(key: string, filePath: string, detail?: any) {
    super(key, filePath, detail);
  }
}

export class PathExistsError extends AbstractFileError {
  code = 12;
  name = "Path exists error";

  constructor(key: string, filePath: string, detail?: any) {
    super(key, filePath, detail);
  }
}

export class NotImplementedError extends AbstractFileError {
  code = -1;
  name = "Not implemented";

  constructor(key: string, filePath: string, detail?: any) {
    super(key, filePath, detail);
  }
}
