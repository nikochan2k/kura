import { AbstractAccessor } from "../AbstractAccessor";
import { AbstractLocalFileSystem } from "../AbstractLocalFileSystem";
import { IdbAccessor } from "./IdbAccessor";

export class IdbLocalFileSystem extends AbstractLocalFileSystem {
  constructor(private dbName: string, useIndex = false) {
    super(useIndex);
  }

  protected createAccessor(useIndex: boolean): Promise<AbstractAccessor> {
    return new Promise<IdbAccessor>((resolve, reject) => {
      const accessor = new IdbAccessor(this.dbName, useIndex);
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
