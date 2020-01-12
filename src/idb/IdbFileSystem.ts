import { AbstractDirectoryEntry } from "../AbstractDirectoryEntry";
import { AbstractFileSystem } from "../AbstractFileSystem";
import { FileSystemParams } from "../FileSystemParams";
import { IdbAccessor } from "./IdbAccessor";
import { IdbDirectoryEntry } from "./IdbDirectoryEntry";

export class IdbFileSystem extends AbstractFileSystem<IdbAccessor> {
  root: IdbDirectoryEntry;

  constructor(accessor: IdbAccessor) {
    super(accessor);
  }

  protected createRoot(
    params: FileSystemParams<IdbAccessor>
  ): AbstractDirectoryEntry<IdbAccessor> {
    return new IdbDirectoryEntry(params);
  }
}
