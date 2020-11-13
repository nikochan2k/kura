export interface FileError extends DOMError {
  // #region Properties (1)

  code: number;

  // #endregion Properties (1)
}

export abstract class AbstractFileError implements FileError {
  // #region Properties (5)

  public abstract code: number;
  public e: any;
  public fullPath: string;
  public key: string;
  public abstract name: string;

  // #endregion Properties (5)

  // #region Constructors (1)

  constructor(key: string, fullPath: string, e?: any) {
    this.key = key;
    this.fullPath = fullPath;
    this.e = e;
  }

  // #endregion Constructors (1)
}

export class NotFoundError extends AbstractFileError {
  // #region Properties (2)

  public code = 1;
  public name = "Not found error";

  // #endregion Properties (2)

  // #region Constructors (1)

  constructor(key: string, fullPath: string, detail?: any) {
    super(key, fullPath, detail);
  }

  // #endregion Constructors (1)
}

export class NotReadableError extends AbstractFileError {
  // #region Properties (2)

  public code = 1;
  public name = "Not readable error";

  // #endregion Properties (2)

  // #region Constructors (1)

  constructor(key: string, fullPath: string, detail?: any) {
    super(key, fullPath, detail);
  }

  // #endregion Constructors (1)
}

export class NoModificationAllowedError extends AbstractFileError {
  // #region Properties (2)

  public code = 6;
  public name = "No modification allowed error";

  // #endregion Properties (2)

  // #region Constructors (1)

  constructor(key: string, fullPath: string, detail?: any) {
    super(key, fullPath, detail);
  }

  // #endregion Constructors (1)
}

export class InvalidStateError extends AbstractFileError {
  // #region Properties (2)

  public code = 7;
  public name = "Invalid state error";

  // #endregion Properties (2)

  // #region Constructors (1)

  constructor(key: string, fullPath: string, detail?: any) {
    super(key, fullPath, detail);
  }

  // #endregion Constructors (1)
}

export class InvalidModificationError extends AbstractFileError {
  // #region Properties (2)

  public code = 9;
  public name = "Invalid modification error";

  // #endregion Properties (2)

  // #region Constructors (1)

  constructor(key: string, fullPath: string, detail?: any) {
    super(key, fullPath, detail);
  }

  // #endregion Constructors (1)
}

export class PathExistsError extends AbstractFileError {
  // #region Properties (2)

  public code = 12;
  public name = "Path exists error";

  // #endregion Properties (2)

  // #region Constructors (1)

  constructor(key: string, fullPath: string, detail?: any) {
    super(key, fullPath, detail);
  }

  // #endregion Constructors (1)
}

export class NotImplementedError extends AbstractFileError {
  // #region Properties (2)

  public code = -1;
  public name = "Not implemented";

  // #endregion Properties (2)

  // #region Constructors (1)

  constructor(key: string, fullPath: string, detail?: any) {
    super(key, fullPath, detail);
  }

  // #endregion Constructors (1)
}
