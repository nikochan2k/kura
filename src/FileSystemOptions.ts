import { Permission } from "./FileSystemIndex";

export interface FileSystemOptions {
  useIndex?: boolean;
  logicalDelete?: boolean;
  verbose?: boolean;
  timeout?: boolean;
  permission?: Permission;
  contentCacheCapacity?: number;
  indexWriteDelayMillis?: number;
}
