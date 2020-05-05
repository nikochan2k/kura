import "../polyfill";
import "fake-indexeddb/auto";
import { testAll } from "./filesystem";
import { IdbLocalFileSystemAsync } from "../idb/IdbLocalFileSystemAsync";

const factory = new IdbLocalFileSystemAsync("web-file-system-test", {
  useIndex: true,
  logicalDelete: true,
  verbose: true,
  indexWriteDelayMillis: 0,
  contentCacheCapacity: 0,
});
testAll(factory);
