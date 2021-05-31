import { AbstractAccessor } from "./AbstractAccessor";
import { FileSystemObject } from "./FileSystemObject";

export class Transferer {
  constructor(
    private fromAccessor: AbstractAccessor,
    private toAccessor: AbstractAccessor
  ) {}

  public async transfer(fromObj: FileSystemObject, toObj: FileSystemObject) {
    const content = await this.fromAccessor.doReadContent(fromObj.fullPath);
    await this.toAccessor.doWriteContent(toObj.fullPath, content);
  }
}
