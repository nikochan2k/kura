export const DIR_SEPARATOR = "/";
export const DIR_OPEN_BOUND = String.fromCharCode(
  DIR_SEPARATOR.charCodeAt(0) + 1
);
export const DEFAULT_BLOB_PROPS: BlobPropertyBag = {
  type: "application/octet-stream"
};
export const EMPTY_BLOB = new Blob([], DEFAULT_BLOB_PROPS);
export const EMPTY_ARRAY_BUFFER = new ArrayBuffer(0);
