import { AbstractAccessor } from "./AbstractAccessor";
import { FileSystemObject } from "./FileSystemObject";

export class Transferer {
  constructor(
    protected fromAccessor: AbstractAccessor,
    protected toAccessor: AbstractAccessor
  ) {}

  public async transfer(fromObj: FileSystemObject, toObj: FileSystemObject) {
    const content = await this.fromAccessor.doReadContent(fromObj.fullPath);
    await this.toAccessor.doWriteContent(toObj.fullPath, content);
  }
}
