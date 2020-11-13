import { AbstractAccessor } from "./AbstractAccessor";
import { FileSystemObject } from "./FileSystemObject";

export interface FileSystemParams<T extends AbstractAccessor>
  extends FileSystemObject {
  // #region Properties (1)

  accessor: T;

  // #endregion Properties (1)
}
