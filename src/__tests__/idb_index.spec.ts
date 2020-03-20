require("../polyfill");
require("fake-indexeddb/auto");
import { testAll } from "./filesystem";
import { AbstractAccessor } from "../AbstractAccessor";
import { IdbLocalFileSystemAsync } from "../idb/IdbLocalFileSystemAsync";

AbstractAccessor.PUT_INDEX_THROTTLE = 0;

const factory = new IdbLocalFileSystemAsync("web-file-system-test", {
  useIndex: true,
  verbose: true
});
testAll(factory);
