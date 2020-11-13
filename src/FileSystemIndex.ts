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

  postDelete?: (record: Record) => void;
  postGet?: (record: Record) => void;
  postHead?: (record: Record) => void;
  postPost?: (record: Record) => void;
  postPut?: (record: Record) => void;
  preDelete?: (record: Record) => Promise<boolean>;
  preGet?: (record: Record) => Promise<boolean>;
  preHead?: (record: Record) => Promise<boolean>;
  prePost?: (record: Record) => Promise<boolean>;
  prePut?: (record: Record) => Promise<boolean>;

  // #endregion Properties (10)
}
