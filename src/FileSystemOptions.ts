import { Permission } from "./FileSystemIndex";

export interface FileSystemOptions {
  useIndex?: boolean;
  verbose?: boolean;
  timeout?: boolean;
  permission?: Permission;
  contentCacheCapacity?: number;
  indexWriteDelayMillis?: number;
}
