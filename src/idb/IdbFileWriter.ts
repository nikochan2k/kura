import { AbstractFileWriter } from "../AbstractFileWriter";
import { IdbAccessor } from "./IdbAccessor";
import { IdbFileEntry } from "./IdbFileEntry";

export class IdbFileWriter extends AbstractFileWriter<IdbAccessor> {
  constructor(fileEntry: IdbFileEntry, file: File) {
    super(fileEntry, file);
  }
}
