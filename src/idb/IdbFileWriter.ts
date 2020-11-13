import { AbstractFileWriter } from "../AbstractFileWriter";
import { IdbAccessor } from "./IdbAccessor";
import { IdbFileEntry } from "./IdbFileEntry";

export class IdbFileWriter extends AbstractFileWriter<IdbAccessor> {
  // #region Constructors (1)

  constructor(fileEntry: IdbFileEntry, file: File) {
    super(fileEntry, file);
  }

  // #endregion Constructors (1)
}
