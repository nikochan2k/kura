import { AbstractAccessor } from "../AbstractAccessor";
import { AbstractLocalFileSystem } from "../AbstractLocalFileSystem";
import { IdbAccessor } from "./IdbAccessor";

export class IdbLocalFileSystem extends AbstractLocalFileSystem {
  constructor(private dbName: string, useIndex = false) {
    super(useIndex);
  }

  protected createAccessor(
    temporary: boolean,
    size: number,
    useIndex: boolean
  ): Promise<AbstractAccessor> {
    if (temporary) {
      throw new Error("No temporary storage");
    }

    return new Promise<IdbAccessor>((resolve, reject) => {
      const accessor = new IdbAccessor(this.dbName, temporary, size, useIndex);
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
