import { AbstractAccessor } from "../AbstractAccessor";
import { AbstractLocalFileSystem } from "../AbstractLocalFileSystem";
import { FileSystemOptions } from "../FileSystemOptions";
import { IdbAccessor } from "./IdbAccessor";

export class IdbLocalFileSystem extends AbstractLocalFileSystem {
  constructor(private dbName: string, options?: FileSystemOptions) {
    super(options);
  }

  protected createAccessor(): Promise<AbstractAccessor> {
    return new Promise<IdbAccessor>((resolve, reject) => {
      const accessor = new IdbAccessor(this.dbName, this.options);
      accessor
        .open(this.dbName)
        .then(() => {
          resolve(accessor);
        })
        .catch(err => {
          reject(err);
        });
    });
  }
}
