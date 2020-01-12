import { AbstractFileWriter } from "../AbstractFileWriter";
import { FileSystemObject } from "../FileSystemObject";
import { FileWriter } from "../filewriter";
import { IdbAccessor } from "./IdbAccessor";
import { IdbFileEntry } from "./IdbFileEntry";

export class IdbFileWriter extends AbstractFileWriter<IdbAccessor>
  implements FileWriter {
  constructor(idbFileEntry: IdbFileEntry, file: File) {
    super(idbFileEntry, file);
  }

  doWrite(file: File, onsuccess: () => void) {
    const entry: FileSystemObject = {
      name: this.fileEntry.name,
      fullPath: this.fileEntry.fullPath,
      lastModified: Date.now(),
      size: file.size
    };

    const writeToIdb = (
      obj: FileSystemObject,
      content: string | Blob,
      onsuccess: () => void
    ) => {
      const accessor = this.fileEntry.params.accessor;
      accessor
        .putObject(obj)
        .then(() => {
          accessor
            .putContent(obj.fullPath, content)
            .then(() => {
              onsuccess();
              if (this.onwriteend) {
                const evt: ProgressEvent<EventTarget> = {
                  loaded: this.position,
                  total: this.length,
                  lengthComputable: true
                } as any;
                this.onwriteend(evt);
              }
            })
            .catch(err => {
              this.handleError(err);
            });
        })
        .catch(err => {
          this.handleError(err);
        });
    };

    if (IdbAccessor.SUPPORTS_BLOB) {
      writeToIdb(entry, file, onsuccess);
    } else {
      const reader = new FileReader();
      reader.onloadend = function() {
        const base64Url = reader.result as string;
        const base64 = base64Url.substr(base64Url.indexOf(",") + 1);
        writeToIdb(entry, base64, onsuccess);
      };
      reader.readAsDataURL(file);
    }
  }
}
