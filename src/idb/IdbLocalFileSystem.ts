import { AbstractAccessor } from "../AbstractAccessor";
import { AbstractLocalFileSystem } from "../AbstractLocalFileSystem";
import { IdbAccessor } from "./IdbAccessor";

export class IdbLocalFileSystem extends AbstractLocalFileSystem {
  protected createAccessor(
    temporary: boolean,
    size: number,
    useIndex: boolean
  ): Promise<AbstractAccessor> {
    if (temporary) {
      throw new Error("No temporary storage");
    }

    return new Promise<IdbAccessor>((resolve, reject) => {
      const accessor = new IdbAccessor(temporary, size, useIndex);
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
