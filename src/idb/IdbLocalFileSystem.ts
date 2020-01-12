import { AbstractAccessor } from "../AbstractAccessor";
import { AbstractLocalFileSystem } from "../AbstractLocalFileSystem";
import { IdbAccessor } from "./IdbAccessor";

export class IdbLocalFileSystem extends AbstractLocalFileSystem {
  protected createAccessor(useIndex: boolean): Promise<AbstractAccessor> {
    return new Promise<IdbAccessor>((resolve, reject) => {
      const accessor = new IdbAccessor(useIndex);
      accessor
        .open(this.bucket)
        .then(() => {
          resolve(accessor);
        })
        .catch(err => {
          reject(err);
        });
    });
  }
}
