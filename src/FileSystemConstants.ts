export const DEFAULT_CONTENT_TYPE = "application/octet-stream";
export const DIR_SEPARATOR = "/";
export const LAST_DIR_SEPARATORS = /\/+$/;
export const DEFAULT_BLOB_PROPS: BlobPropertyBag = {
  type: DEFAULT_CONTENT_TYPE,
};
export const EMPTY_BLOB = new Blob([], DEFAULT_BLOB_PROPS);
export const EMPTY_ARRAY_BUFFER = new ArrayBuffer(0);
export const INDEX_FILE_PATH = "/.index.json";
export const INDEX_FILE_NAME = ".index.json";
