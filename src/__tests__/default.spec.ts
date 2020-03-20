import "../polyfill";
import "fake-indexeddb/auto";
import { DefaultLocalFileSystemAsync } from "../default";
import { testAll } from "./filesystem";

const factory = new DefaultLocalFileSystemAsync();
testAll(factory);
