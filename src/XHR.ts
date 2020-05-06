import { DEFAULT_CONTENT_TYPE } from "./FileSystemConstants";
import { NotFoundError } from "./FileError";

export interface XHROptions {
  timeout?: number;
  requestHeaders?: { [key: string]: string };
}

export class XHR {
  private options: XHROptions;

  constructor(
    private key?: string,
    private fullPath?: string,
    options?: XHROptions
  ) {
    if (options == null) {
      options = {};
    }
    if (!(0 <= options.timeout)) {
      options.timeout = 3000;
    }
    if (options.requestHeaders == null) {
      options.requestHeaders = {};
    }
    this.options = options;
  }

  async get(
    url: string,
    responseType: XMLHttpRequestResponseType
  ): Promise<any> {
    const { xhr, promise } = this.createXMLHttpRequest();
    xhr.open("GET", url);
    this.configure(xhr);
    xhr.responseType = responseType;
    xhr.send();
    return await promise;
  }

  async post(url: string, content: Blob | Uint8Array | string, type?: string) {
    await this.xhr("POST", url, content, type);
  }

  async put(url: string, content: Blob | Uint8Array | string, type?: string) {
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
          reject(new NotFoundError(this.key, this.fullPath, error));
        }
        reject(`${xhr.status}(${xhr.statusText}): ${error}`);
      };
    });
    return { xhr, promise };
  }

  private async xhr(
    method: string,
    url: string,
    content: Blob | Uint8Array | string,
    type?: string
  ): Promise<void> {
    const { xhr, promise } = this.createXMLHttpRequest();
    xhr.open(method, url);
    this.configure(xhr);
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
