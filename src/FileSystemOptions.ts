import { Event } from "./FileSystemIndex";

export interface IndexOptions {
  // #region Properties (1)

  noCache?: boolean;
  logicalDelete?: boolean;

  // #endregion Properties (1)
}

export interface ContentsCacheOptions {
  // #region Properties (2)

  capacity?: number;
  limitSize?: number;

  // #endregion Properties (2)
}

export interface FileSystemOptions {
  // #region Properties (6)

  contentsCache?: boolean;
  contentsCacheOptions?: ContentsCacheOptions;
  event?: Event;
  index?: boolean;
  indexOptions?: IndexOptions;
  verbose?: boolean;

  // #endregion Properties (6)
}
