import "../polyfill";
import "fake-indexeddb/auto";
import { IdbLocalFileSystemAsync } from "../idb/IdbLocalFileSystemAsync";
import { testAll } from "./filesystem";

const factory = new IdbLocalFileSystemAsync("web-file-system-test", {
  index: true,
  indexOptions: {
    writeDelayMillis: 0,
  },
  contentsCache: false,
  verbose: true,
});
testAll(factory);
