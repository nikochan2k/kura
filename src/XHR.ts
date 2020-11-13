import { DEFAULT_CONTENT_TYPE } from "./FileSystemConstants";
import { NotFoundError } from "./FileError";

export interface XHROptions {
  // #region Properties (2)

  requestHeaders?: { [key: string]: string };
  timeout?: number;

  // #endregion Properties (2)
}

export class XHR {
  // #region Properties (3)

  private handled: boolean;
  private options: XHROptions;
  private url: string;

  // #endregion Properties (3)

  // #region Constructors (1)

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

  // #endregion Constructors (1)

  // #region Public Methods (3)

  public async get(
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

  public async post(
    url: string,
    content: Blob | Uint8Array | string,
    type?: string
  ) {
    await this.xhr("POST", url, content, type);
  }

  public async put(
    url: string,
    content: Blob | Uint8Array | string,
    type?: string
  ) {
    await this.xhr("PUT", url, content, type);
  }

  // #endregion Public Methods (3)

  // #region Private Methods (3)

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
      xhr.onerror = () => {
        if (!this.handled) {
          reject(new Error(`${this.url}: ${xhr.status} (${xhr.statusText})`));
        }
      };
      xhr.ontimeout = () => {
        if (!this.handled) {
          reject(new Error(`${this.url}: timeout`));
        }
      };
      xhr.onabort = () => {
        if (!this.handled) {
          reject(new Error(`${this.url}: aborted`));
        }
      };
      xhr.onreadystatechange = () => {
        if (xhr.readyState !== XMLHttpRequest.DONE) {
          return;
        }

        if ((200 <= xhr.status && xhr.status < 300) || xhr.status === 304) {
          resolve(xhr.response);
        } else if (xhr.status === 404) {
          reject(new NotFoundError(this.key, this.fullPath));
        } else {
          reject(new Error(`${this.url}: ${xhr.status} (${xhr.statusText})`));
        }
        this.handled = true;
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
    this.handled = false;
    this.url = url;
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

  // #endregion Private Methods (3)
}
