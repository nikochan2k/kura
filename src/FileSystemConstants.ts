export const CONTENT_TYPE = "application/octet-stream";
export const DIR_SEPARATOR = "/";
export const LAST_DIR_SEPARATORS = /\/+$/;
export const DIR_OPEN_BOUND = String.fromCharCode(
  DIR_SEPARATOR.charCodeAt(0) + 1
);
export const DEFAULT_BLOB_PROPS: BlobPropertyBag = {
  type: CONTENT_TYPE
};
export const EMPTY_BLOB = new Blob([], DEFAULT_BLOB_PROPS);
export const INDEX_FILE_PATH = "/.index.json";
