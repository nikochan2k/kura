import { AbstractAccessor } from "../AbstractAccessor";
import { AbstractLocalFileSystem } from "../AbstractLocalFileSystem";
import { IdbAccessor } from "./IdbAccessor";
import { Permission } from "../FileSystemIndex";

export class IdbLocalFileSystem extends AbstractLocalFileSystem {
  constructor(dbName: string);
  constructor(dbName: string, useIndex: boolean);
  constructor(dbName: string, permission: Permission);
  constructor(private dbName: string, value?: any) {
    super(value);
  }

  protected createAccessor(): Promise<AbstractAccessor> {
    return new Promise<IdbAccessor>((resolve, reject) => {
      const accessor = new IdbAccessor(this.dbName, this.permission);
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
