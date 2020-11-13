import { AbstractAccessor } from "../AbstractAccessor";
import { AbstractLocalFileSystem } from "../AbstractLocalFileSystem";
import { FileSystemOptions } from "../FileSystemOptions";
import { IdbAccessor } from "./IdbAccessor";

export class IdbLocalFileSystem extends AbstractLocalFileSystem {
  // #region Constructors (1)

  constructor(private dbName: string, options?: FileSystemOptions) {
    super(options);
  }

  // #endregion Constructors (1)

  // #region Protected Methods (1)

  protected createAccessor(): Promise<AbstractAccessor> {
    return new Promise<IdbAccessor>((resolve, reject) => {
      const accessor = new IdbAccessor(this.dbName, this.options);
      accessor
        .open(this.dbName)
        .then(() => {
          resolve(accessor);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  // #endregion Protected Methods (1)
}
