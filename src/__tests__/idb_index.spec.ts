require("fake-indexeddb/auto");
import { AbstractAccessor } from "../AbstractAccessor";
import { IdbLocalFileSystemAsync } from "../idb/IdbLocalFileSystemAsync";
import { testAll } from "./filesystem";

AbstractAccessor.PUT_INDEX_THROTTLE = 0;

const factory = new IdbLocalFileSystemAsync("web-file-system-test", {
  useIndex: true
});
testAll(factory);
