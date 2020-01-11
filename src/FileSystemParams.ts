import { AbstractAccessor } from "./AbstractAccessor";
import { FileSystemObject } from "./FileSystemObject";

export interface FileSystemParams<T extends AbstractAccessor>
  extends FileSystemObject {
  accessor: AbstractAccessor;
}
