import "../polyfill";
import "fake-indexeddb/auto";
import { testAll } from "./filesystem";
import { IdbLocalFileSystemAsync } from "../idb/IdbLocalFileSystemAsync";

const factory = new IdbLocalFileSystemAsync("web-file-system-test", {
  index: true,
  indexOptions: {
    writeDelayMillis: 0,
  },
  contentsCache: false,
  verbose: true,
});
testAll(factory);
