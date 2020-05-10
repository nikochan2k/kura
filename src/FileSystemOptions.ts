import { Permission } from "./FileSystemIndex";

export interface IndexOptions {
  writeDelayMillis?: number;
  logicalDelete?: boolean;
}

export interface ContentsCacheOptions {
  capacity?: number;
  limitSize?: number;
}

export interface FileSystemOptions {
  shared?: boolean;
  index?: boolean;
  indexOptions?: IndexOptions;
  contentsCache?: boolean;
  contentsCacheOptions?: ContentsCacheOptions;
  permission?: Permission;
  verbose?: boolean;
}
