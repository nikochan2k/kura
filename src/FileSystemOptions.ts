import { Event } from "./FileSystemIndex";

export interface IndexOptions {
  logicalDelete?: boolean;
  noCache?: boolean;
}

export interface ContentsCacheOptions {
  capacity?: number;
  limitSize?: number;
}

export interface FileSystemOptions {
  contentsCache?: boolean;
  contentsCacheOptions?: ContentsCacheOptions;
  event?: Event;
  index?: boolean;
  indexOptions?: IndexOptions;
  verbose?: boolean;
}
