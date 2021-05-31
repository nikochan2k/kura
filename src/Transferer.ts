import { AbstractAccessor } from "./AbstractAccessor";
import { FileSystemObject } from "./FileSystemObject";

export class Transferer {
  public async transfer(
    fromAccessor: AbstractAccessor,
    fromObj: FileSystemObject,
    toAccessor: AbstractAccessor,
    toObj: FileSystemObject
  ) {
    const content = await fromAccessor.readContentInternal(fromObj);
    await toAccessor.doWriteContent(toObj.fullPath, content);
  }
}
