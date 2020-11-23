import { FileSystemObject } from "./FileSystemObject";

export interface Record {
  // #region Properties (3)

  deleted?: number;
  modified: number;
  obj: FileSystemObject;

  // #endregion Properties (3)

  // #region Public Indexers (1)

  [key: string]: any;

  // #endregion Public Indexers (1)
}

export interface FileNameIndex {
  // #region Public Indexers (1)

  [name: string]: Record;

  // #endregion Public Indexers (1)
}

export interface DirPathIndex {
  // #region Public Indexers (1)

  [dirPath: string]: FileNameIndex;

  // #endregion Public Indexers (1)
}

export interface Event {
  // #region Properties (10)

  postDelete?: (obj: FileSystemObject) => void;
  postGet?: (obj: FileSystemObject) => void;
  postHead?: (obj: FileSystemObject) => void;
  postPost?: (obj: FileSystemObject) => void;
  postPut?: (obj: FileSystemObject) => void;
  preDelete?: (obj: FileSystemObject) => Promise<boolean>;
  preGet?: (obj: FileSystemObject) => Promise<boolean>;
  preHead?: (obj: FileSystemObject) => Promise<boolean>;
  prePost?: (obj: FileSystemObject) => Promise<boolean>;
  prePut?: (obj: FileSystemObject) => Promise<boolean>;

  // #endregion Properties (10)
}
