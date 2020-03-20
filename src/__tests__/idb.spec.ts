require("../polyfill");
require("fake-indexeddb/auto");
import { IdbLocalFileSystemAsync } from "../idb/IdbLocalFileSystemAsync";
import { testAll } from "./filesystem";

const factory = new IdbLocalFileSystemAsync("web-file-system-test", {
  verbose: true
});
testAll(factory);
