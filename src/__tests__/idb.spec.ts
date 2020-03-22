import "../polyfill";
import "fake-indexeddb/auto";
import { IdbLocalFileSystemAsync } from "../idb/IdbLocalFileSystemAsync";
import { testAll } from "./filesystem";

const factory = new IdbLocalFileSystemAsync("web-file-system-test", {
  verbose: true,
  indexWriteDelayMillis: 0,
  contentCacheCapacity: 0
});
testAll(factory);
