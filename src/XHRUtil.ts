import { DEFAULT_CONTENT_TYPE } from "./FileSystemConstants";
import { NotFoundError } from "./FileError";

export function createXMLHttpRequest(key: string, fullPath: string) {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<any>((resolve, reject) => {
    let error: any;
    xhr.onerror = (ev) => {
      error = ev;
    };
    xhr.onreadystatechange = () => {
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

export async function xhrGet(
  url: string,
  responseType: XMLHttpRequestResponseType,
  key?: string,
  fullPath?: string
): Promise<any> {
  const { xhr, promise } = createXMLHttpRequest(key, fullPath);
  xhr.open("GET", url);
  xhr.responseType = responseType;
  xhr.send();
  return await promise;
}

async function xhr(
  method: string,
  url: string,
  content: Blob | Uint8Array | ArrayBuffer | string,
  type?: string,
  key?: string,
  fullPath?: string
): Promise<void> {
  const { xhr, promise } = createXMLHttpRequest(key, fullPath);
  xhr.open(method, url);
  if (!type) {
    if (content instanceof Blob) {
      type = content.type;
    }
    if (!type) {
      type = DEFAULT_CONTENT_TYPE;
    }
  }
  xhr.setRequestHeader("Content-Type", type);
  xhr.send(content);
  await promise;
}

export async function xhrPut(
  url: string,
  content: Blob | Uint8Array | ArrayBuffer | string,
  type?: string,
  key?: string,
  fullPath?: string
) {
  await xhr("PUT", url, content, type, key, fullPath);
}

export async function xhrPost(
  url: string,
  content: Blob | Uint8Array | ArrayBuffer | string,
  type?: string,
  key?: string,
  fullPath?: string
) {
  await xhr("POST", url, content, type, key, fullPath);
}
