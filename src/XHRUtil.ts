import { CONTENT_TYPE } from "./FileSystemConstants";
import { NotFoundError } from "./FileError";

export function createXMLHttpRequest(key: string, fullPath: string) {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<any>((resolve, reject) => {
    let error: any;
    xhr.onerror = ev => {
      error = ev;
    };
    xhr.onreadystatechange = ev => {
      if (xhr.readyState !== XMLHttpRequest.DONE) {
        return;
      }
      if ((200 <= xhr.status && xhr.status < 300) || xhr.status === 304) {
        resolve(xhr.response);
      } else if (xhr.status === 404) {
        reject(new NotFoundError(key, fullPath, error));
      }
      reject(`${xhr.status}(${xhr.statusText}): ${error}`);
    };
  });
  return { xhr, promise };
}

export async function xhrGetBlob(
  url: string,
  key: string,
  fullPath: string
): Promise<Blob> {
  const { xhr, promise } = createXMLHttpRequest(key, fullPath);
  xhr.open("GET", url);
  xhr.responseType = "blob";
  xhr.send();
  return await promise;
}

export async function xhrGetText(
  url: string,
  key: string,
  fullPath: string,
  overrideMimeType?: string
): Promise<string> {
  const { xhr, promise } = createXMLHttpRequest(key, fullPath);
  xhr.open("GET", url);
  if (overrideMimeType) {
    xhr.overrideMimeType(overrideMimeType);
  }
  xhr.responseType = "text";
  xhr.send();
  return await promise;
}

export async function xhrGetJSON(
  url: string,
  key: string,
  fullPath: string
): Promise<any> {
  const { xhr, promise } = createXMLHttpRequest(key, fullPath);
  xhr.open("GET", url);
  xhr.responseType = "json";
  xhr.send();
  return await promise;
}

export async function xhrGetArrayBuffer(
  url: string,
  key: string,
  fullPath: string
): Promise<any> {
  const { xhr, promise } = createXMLHttpRequest(key, fullPath);
  xhr.open("GET", url);
  xhr.responseType = "arraybuffer";
  xhr.send();
  return await promise;
}

async function xhr(
  method: string,
  url: string,
  content: Blob,
  key: string,
  fullPath: string
): Promise<void> {
  const { xhr, promise } = createXMLHttpRequest(key, fullPath);
  xhr.open(method, url);
  const type = content.type || CONTENT_TYPE;
  xhr.setRequestHeader("Content-Type", type);
  xhr.send(content);
  await promise;
}

export async function xhrPut(
  url: string,
  content: Blob,
  key: string,
  fullPath: string
) {
  await xhr("PUT", url, content, key, fullPath);
}

export async function xhrPost(
  url: string,
  content: Blob,
  key: string,
  fullPath: string
) {
  await xhr("POST", url, content, key, fullPath);
}
