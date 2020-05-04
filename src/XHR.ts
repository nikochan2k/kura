import { DEFAULT_CONTENT_TYPE } from "./FileSystemConstants";
import { NotFoundError } from "./FileError";

interface XHROptions {
  fullPath?: string;
  key?: string;
  noCache?: boolean;
  requestHeaders?: { [key: string]: string };
  timeout?: number;
}

export class XHR {
  constructor(private options: XHROptions) {
    if (options.noCache == null) {
      options.noCache = true;
    }
    if (options.timeout == null) {
      options.timeout = 3000;
    } else if (options.timeout < 0) {
      options.timeout = 0;
    }
  }

  async xhrGet(
    url: string,
    responseType: XMLHttpRequestResponseType
  ): Promise<any> {
    const { xhr, promise } = this.createXMLHttpRequest();
    xhr.open("GET", url);
    if (this.options.noCache) {
      xhr.setRequestHeader("Pragma", "no-cache");
      xhr.setRequestHeader("Cache-Control", "no-cache");
      xhr.setRequestHeader(
        "If-Modified-Since",
        "Thu, 01 Jun 1970 00:00:00 GMT"
      );
    }
    xhr.responseType = responseType;
    xhr.send();
    return await promise;
  }

  async xhrPost(
    url: string,
    content: Blob | Uint8Array | ArrayBuffer | string,
    type?: string
  ) {
    await this.xhr("POST", url, content, type);
  }

  async xhrPut(
    url: string,
    content: Blob | Uint8Array | ArrayBuffer | string,
    type?: string
  ) {
    await this.xhr("PUT", url, content, type);
  }

  private configure(xhr: XMLHttpRequest) {
    xhr.timeout = this.options.timeout;
    if (this.options.requestHeaders) {
      for (const [key, value] of Object.entries(this.options.requestHeaders)) {
        xhr.setRequestHeader(key, value);
      }
    }
  }

  private createXMLHttpRequest() {
    const xhr = new XMLHttpRequest();
    const promise = new Promise<any>((resolve, reject) => {
      let error: any;
      xhr.onerror = (ev) => {
        error = ev;
      };
      xhr.ontimeout = (ev) => {
        error = ev;
      };
      xhr.onreadystatechange = () => {
        if (xhr.readyState !== XMLHttpRequest.DONE) {
          return;
        }
        if ((200 <= xhr.status && xhr.status < 300) || xhr.status === 304) {
          resolve(xhr.response);
        } else if (xhr.status === 404) {
          reject(
            new NotFoundError(this.options.key, this.options.fullPath, error)
          );
        }
        reject(`${xhr.status}(${xhr.statusText}): ${error}`);
      };
    });
    return { xhr, promise };
  }

  private async xhr(
    method: string,
    url: string,
    content: Blob | Uint8Array | ArrayBuffer | string,
    type?: string
  ): Promise<void> {
    const { xhr, promise } = this.createXMLHttpRequest();
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
}
