import { Event } from "./FileSystemIndex";

export interface IndexOptions {
  logicalDelete?: boolean;
}

export interface ContentsCacheOptions {
  capacity?: number;
  limitSize?: number;
}

export interface FileSystemOptions {
  index?: boolean;
  indexOptions?: IndexOptions;
  contentsCache?: boolean;
  contentsCacheOptions?: ContentsCacheOptions;
  event?: Event;
  verbose?: boolean;
}
