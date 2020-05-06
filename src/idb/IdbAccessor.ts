import { AbstractAccessor } from "../AbstractAccessor";
import { toArrayBuffer, toBase64, toBlob } from "../BinaryConverter";
import {
  InvalidModificationError,
  NotFoundError,
  NotReadableError,
} from "../FileError";
import { DIR_SEPARATOR } from "../FileSystemConstants";
import { FileSystemObject } from "../FileSystemObject";
import { FileSystemOptions } from "../FileSystemOptions";
import { IdbFileSystem } from "./IdbFileSystem";
import { countSlash, getRange } from "./IdbUtil";

const ENTRY_STORE = "entries";
const CONTENT_STORE = "contents";

const indexedDB: IDBFactory =
  window.indexedDB || window.mozIndexedDB || window.msIndexedDB;

export class IdbAccessor extends AbstractAccessor {
  private static SUPPORTS_ARRAY_BUFFER: boolean;
  private static SUPPORTS_BLOB: boolean;

  db: IDBDatabase;
  filesystem: IdbFileSystem;

  constructor(private dbName: string, options: FileSystemOptions) {
    super(options);
    this.filesystem = new IdbFileSystem(this);
  }

  get name() {
    return this.dbName;
  }

  doDelete(fullPath: string, isFile: boolean) {
    return new Promise<void>(async (resolve, reject) => {
      const entryTx = this.db.transaction([ENTRY_STORE], "readwrite");
      const onerror = (ev: Event) =>
        reject(new InvalidModificationError(this.name, fullPath, ev));
      entryTx.onabort = onerror;
      entryTx.onerror = onerror;
      entryTx.oncomplete = () => {
        resolve();
      };
      let range = IDBKeyRange.only(fullPath);
      const request = entryTx.objectStore(ENTRY_STORE).delete(range);
      request.onerror = onerror;
    });
  }

  doGetContent(
    fullPath: string
  ): Promise<Blob | Uint8Array | ArrayBuffer | string> {
    return new Promise<any>((resolve, reject) => {
      const onerror = (ev: Event) =>
        reject(new NotReadableError(this.name, fullPath, ev));
      const tx = this.db.transaction([CONTENT_STORE], "readonly");
      const range = IDBKeyRange.only(fullPath);
      tx.onabort = onerror;
      tx.onerror = onerror;
      const request = tx.objectStore(CONTENT_STORE).get(range);
      request.onerror = onerror;
      const name = this.name;
      tx.oncomplete = () => {
        if (request.result != null) {
          resolve(request.result);
        } else {
          reject(new NotFoundError(name, fullPath));
        }
      };
    });
  }

  doGetObject(fullPath: string) {
    return new Promise<FileSystemObject>((resolve, reject) => {
      const tx = this.db.transaction([ENTRY_STORE], "readonly");
      const range = IDBKeyRange.only(fullPath);
      const onerror = (ev: Event) =>
        reject(new NotReadableError(this.name, fullPath, ev));
      tx.onabort = onerror;
      tx.onerror = onerror;
      const request = tx.objectStore(ENTRY_STORE).get(range);
      tx.oncomplete = () => {
        if (request.result != null) {
          resolve(request.result);
        } else {
          reject(new NotFoundError(name, fullPath));
        }
      };
      request.onerror = onerror;
    });
  }

  doGetObjects(fullPath: string) {
    return new Promise<FileSystemObject[]>((resolve, reject) => {
      const tx = this.db.transaction([ENTRY_STORE], "readonly");
      const onerror = (ev: Event) =>
        reject(new NotReadableError(this.name, fullPath, ev));
      tx.onabort = onerror;
      tx.onerror = onerror;
      const objects: FileSystemObject[] = [];
      tx.oncomplete = () => resolve(objects);

      let slashCount: number;
      if (fullPath === DIR_SEPARATOR) {
        slashCount = 1;
      } else {
        slashCount = countSlash(fullPath) + 1; // + 1 is the last slash for directory
      }
      const range = getRange(fullPath);
      const request = tx.objectStore(ENTRY_STORE).openCursor(range);
      request.onsuccess = (ev) => {
        const cursor = <IDBCursorWithValue>(<IDBRequest>ev.target).result;
        if (cursor) {
          const obj = cursor.value as FileSystemObject;

          if (slashCount === countSlash(obj.fullPath)) {
            objects.push(obj);
          }

          cursor.continue();
        }
      };
      request.onerror = onerror;
    });
  }

  doPutObject(obj: FileSystemObject) {
    return new Promise<void>((resolve, reject) => {
      const entryTx = this.db.transaction([ENTRY_STORE], "readwrite");
      const onerror = (ev: Event) =>
        reject(new InvalidModificationError(this.name, obj.fullPath, ev));
      entryTx.onabort = onerror;
      entryTx.onerror = onerror;
      entryTx.oncomplete = () => {
        resolve();
      };
      const entryReq = entryTx.objectStore(ENTRY_STORE).put(obj, obj.fullPath);
      entryReq.onerror = onerror;
    });
  }

  async open(dbName: string) {
    if (
      IdbAccessor.SUPPORTS_BLOB == null ||
      IdbAccessor.SUPPORTS_ARRAY_BUFFER == null
    ) {
      await this.initializeDB();
    }

    const self = this;
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(dbName.replace(":", "_"));
      const onError = (ev: Event) => {
        console.log(ev);
      };
      request.onupgradeneeded = (ev) => {
        const request = ev.target as IDBRequest;
        self.db = request.result;
        self.db.onerror = onError;

        if (!self.db.objectStoreNames.contains(ENTRY_STORE)) {
          self.db.createObjectStore(ENTRY_STORE);
        }
        if (!self.db.objectStoreNames.contains(CONTENT_STORE)) {
          self.db.createObjectStore(CONTENT_STORE);
        }
      };
      request.onsuccess = (e) => {
        self.db = (e.target as IDBRequest).result;
        self.db.onerror = onError;
        resolve();
      };
      const onerror = (ev: Event) => reject(ev);
      request.onerror = onerror;
      request.onblocked = onerror;
    });
  }

  protected close() {
    this.db.close();
    delete this.db;
  }

  protected async doPutArrayBuffer(
    fullPath: string,
    buffer: ArrayBuffer
  ): Promise<void> {
    let content: Blob | Uint8Array | ArrayBuffer | string;
    if (IdbAccessor.SUPPORTS_ARRAY_BUFFER) {
      content = buffer;
    } else if (IdbAccessor.SUPPORTS_BLOB) {
      content = toBlob(buffer);
    } else {
      content = await toBase64(buffer);
    }
    await this.doPutContentToIdb(fullPath, content);
  }

  protected async doPutBase64(fullPath: string, base64: string): Promise<void> {
    await this.doPutContentToIdb(fullPath, base64);
  }

  protected async doPutBlob(fullPath: string, blob: Blob): Promise<void> {
    let content: Blob | Uint8Array | ArrayBuffer | string;
    if (IdbAccessor.SUPPORTS_BLOB) {
      content = blob;
    } else if (IdbAccessor.SUPPORTS_ARRAY_BUFFER) {
      content = await toArrayBuffer(blob);
    } else {
      content = await toBase64(blob);
    }
    await this.doPutContentToIdb(fullPath, content);
  }

  protected drop() {
    return new Promise<void>((resolve, reject) => {
      const dbName = this.db.name;
      const request = indexedDB.deleteDatabase(dbName);
      const onerror = (ev: Event) => reject(ev);
      request.onblocked = onerror;
      request.onerror = onerror;
      request.onsuccess = () => resolve();
      this.close();
    });
  }

  protected async initializeDB() {
    await new Promise((resolve, reject) => {
      const dbName = "blob-support";
      indexedDB.deleteDatabase(dbName).onsuccess = function () {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore("store");
        request.onsuccess = () => {
          const db = request.result;
          try {
            const blob = new Blob(["test"]);
            const transaction = db.transaction("store", "readwrite");
            transaction.objectStore("store").put(blob, "key");
            IdbAccessor.SUPPORTS_BLOB = true;
          } catch (err) {
            IdbAccessor.SUPPORTS_BLOB = false;
          } finally {
            db.close();
            indexedDB.deleteDatabase(dbName);
          }
          resolve();
        };
        request.onerror = (ev: Event) => reject(ev);
      };
    });
    await new Promise((resolve, reject) => {
      const dbName = "arraybuffer-support";
      indexedDB.deleteDatabase(dbName).onsuccess = function () {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore("store");
        request.onsuccess = () => {
          const db = request.result;
          try {
            const buffer = new ArrayBuffer(10);
            const transaction = db.transaction("store", "readwrite");
            transaction.objectStore("store").put(buffer, "key");
            IdbAccessor.SUPPORTS_ARRAY_BUFFER = true;
          } catch (err) {
            IdbAccessor.SUPPORTS_ARRAY_BUFFER = false;
          } finally {
            db.close();
            indexedDB.deleteDatabase(dbName);
          }
          resolve();
        };
        request.onerror = (ev: Event) => reject(ev);
      };
    });
  }

  protected initializeContentCacheOptions(options: FileSystemOptions) {
    if (options.contentsCache == null) {
      options.contentsCache = true;
    } else if (options.contentsCache === false) {
      return;
    }

    if (options.contentsCacheOptions == null) {
      options.contentsCacheOptions = {};
    }
    const contentsCacheOptions = options.contentsCacheOptions;
    if (!(0 < contentsCacheOptions.capacity)) {
      contentsCacheOptions.capacity = 10 * 1024 * 1024; // 10MB
    }
    if (!(0 < contentsCacheOptions.limitSize)) {
      contentsCacheOptions.limitSize = 128 * 1024; // 128KB;
    }
    if (contentsCacheOptions.capacity < contentsCacheOptions.limitSize) {
      contentsCacheOptions.limitSize = contentsCacheOptions.capacity;
    }
    if (contentsCacheOptions.private == null) {
      contentsCacheOptions.private = true;
    }
  }

  private doPutContentToIdb(fullPath: string, content: any) {
    return new Promise<void>((resolve, reject) => {
      const contentTx = this.db.transaction([CONTENT_STORE], "readwrite");
      const onerror = (ev: Event) =>
        reject(new InvalidModificationError(this.name, fullPath, ev));
      contentTx.onabort = onerror;
      contentTx.onerror = onerror;
      contentTx.oncomplete = () => {
        resolve();
      };
      const contentReq = contentTx
        .objectStore(CONTENT_STORE)
        .put(content, fullPath);
      contentReq.onerror = onerror;
    });
  }
}
