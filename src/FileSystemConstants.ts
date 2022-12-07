export const DEFAULT_CONTENT_TYPE = "application/octet-stream";
export const DIR_SEPARATOR = "/";
export const LAST_DIR_SEPARATORS = /\/+$/;
export const DEFAULT_BLOB_PROPS: BlobPropertyBag = {
  type: DEFAULT_CONTENT_TYPE,
};
export const INDEX_DIR_NAME = ".index";
export const INDEX_DIR_PATH = DIR_SEPARATOR + INDEX_DIR_NAME;
export const INDEX_FILE_NAME = "index.json";
export const INDEX_PREFIX = "_";
export const INDEX_PREFIX_LEN = INDEX_PREFIX.length;
