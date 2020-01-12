import { AbstractFileWriter } from "../AbstractFileWriter";
import { FileWriter } from "../filewriter";
import { IdbAccessor } from "./IdbAccessor";
import { IdbFileEntry } from "./IdbFileEntry";

export class IdbFileWriter extends AbstractFileWriter<IdbAccessor>
  implements FileWriter {
  constructor(idbFileEntry: IdbFileEntry, file: File) {
    super(idbFileEntry, file);
  }
}
