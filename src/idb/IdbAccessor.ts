import { AbstractAccessor } from "../AbstractAccessor";
import {
  isBlob,
  isBuffer,
  toArrayBuffer,
  toBase64,
  toBlob,
} from "../BinaryConverter";
import {
  AbstractFileError,
  InvalidModificationError,
  NotFoundError,
} from "../FileError";
import { DIR_SEPARATOR, INDEX_FILE_NAME } from "../FileSystemConstants";
import { FileSystemObject } from "../FileSystemObject";
import { FileSystemOptions } from "../FileSystemOptions";
import { getName, getSize } from "../FileSystemUtil";
import { objectToText } from "../ObjectUtil";
import { textToUint8Array } from "../TextConverter";
import { IdbFileSystem } from "./IdbFileSystem";
import { countSlash, getRange } from "./IdbUtil";

const ENTRY_STORE = "entries";
const CONTENT_STORE = "contents";

const indexedDB: IDBFactory =
  window.indexedDB || window.mozIndexedDB || window.msIndexedDB;

export class IdbAccessor extends AbstractAccessor {
  private static SUPPORTS_ARRAY_BUFFER: boolean;
  private static SUPPORTS_BLOB: boolean;

  public filesystem: IdbFileSystem;

  constructor(private dbName: string, options: FileSystemOptions) {
    super(options);
    this.filesystem = new IdbFileSystem(this);
  }

  public get name() {
    return this.dbName;
  }

  public async doDelete(fullPath: string, _isFile: boolean) {
    try {
      await this.doGetObject(fullPath);
    } catch {
      // NotFoundError
      return;
    }

    await this.doDeleteWithStore(ENTRY_STORE, fullPath);
    await this.doDeleteWithStore(CONTENT_STORE, fullPath);
  }

  public doGetObject(fullPath: string) {
    return new Promise<FileSystemObject>(async (resolve, reject) => {
      const db = await this.open(this.dbName);
      const tx = db.transaction([ENTRY_STORE], "readonly");
      const range = IDBKeyRange.only(fullPath);
      const onError = (ev: Event) => {
        const req = ev.target as IDBRequest;
        db.close();
        reject(new NotFoundError(this.name, fullPath, req.error || ev));
      };
      tx.onabort = onError;
      tx.onerror = onError;
      const request = tx.objectStore(ENTRY_STORE).get(range);
      const onSuccess = () => {
        db.close();
        if (request.result != null) {
          resolve(request.result);
        } else {
          reject(new NotFoundError(this.name, fullPath));
        }
      };
      tx.oncomplete = onSuccess;
      request.onerror = onError;
    });
  }

  public doGetObjects(fullPath: string) {
    return new Promise<FileSystemObject[]>(async (resolve, reject) => {
      const db = await this.open(this.dbName);
      const tx = db.transaction([ENTRY_STORE], "readonly");
      const onError = (ev: Event) => {
        const req = ev.target as IDBRequest;
        db.close();
        reject(new NotFoundError(this.name, fullPath, req.error || ev));
      };
      tx.onabort = onError;
      tx.onerror = onError;
      const objects: FileSystemObject[] = [];
      tx.oncomplete = () => {
        db.close();
        resolve(objects);
      };

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
      request.onerror = onError;
    });
  }

  public doMakeDirectory(obj: FileSystemObject) {
    return this.doPutObject(obj);
  }

  public doPutObject(obj: FileSystemObject) {
    return new Promise<void>(async (resolve, reject) => {
      const db = await this.open(this.dbName);
      const entryTx = db.transaction([ENTRY_STORE], "readwrite");
      const onError = (ev: Event) => {
        db.close();
        reject(new InvalidModificationError(this.name, obj.fullPath, ev));
      };
      entryTx.onabort = onError;
      entryTx.onerror = onError;
      entryTx.oncomplete = () => {
        db.close();
        resolve();
      };
      const entryReq = entryTx.objectStore(ENTRY_STORE).put(obj, obj.fullPath);
      entryReq.onerror = onError;
    });
  }

  public doReadContent(
    fullPath: string
  ): Promise<Blob | BufferSource | string> {
    return new Promise<any>(async (resolve, reject) => {
      const db = await this.open(this.dbName);
      const onError = (ev: Event) => {
        const req = ev.target as IDBRequest;
        db.close();
        reject(new NotFoundError(this.name, fullPath, req.error || ev));
      };
      const tx = db.transaction([CONTENT_STORE], "readonly");
      const range = IDBKeyRange.only(fullPath);
      tx.onabort = onError;
      tx.onerror = onError;
      const request = tx.objectStore(CONTENT_STORE).get(range);
      request.onerror = onError;
      const name = this.name;
      tx.oncomplete = () => {
        db.close();
        if (request.result != null) {
          resolve(request.result);
        } else {
          reject(new NotFoundError(name, fullPath));
        }
      };
    });
  }

  public async doWriteContent(
    fullPath: string,
    content: Blob | BufferSource | string
  ) {
    try {
      const obj: FileSystemObject = {
        fullPath: fullPath,
        name: getName(fullPath),
        lastModified: Date.now(),
        size: getSize(content),
      };
      await this.doPutObject(obj);

      if (typeof content === "string") {
        await this.doWriteBase64(fullPath, content);
      } else if (isBlob(content)) {
        await this.doWriteBlob(fullPath, content);
      } else if (isBuffer(content)) {
        await this.doWriteBuffer(fullPath, content);
      } else if (ArrayBuffer.isView(content)) {
        await this.doWriteUint8Array(fullPath, content as Uint8Array);
      } else {
        await this.doWriteArrayBuffer(fullPath, content);
      }
    } catch (e) {
      if (e instanceof AbstractFileError) {
        throw e;
      }
      throw new InvalidModificationError(this.name, fullPath, e);
    }
  }

  public async open(dbName: string) {
    if (
      IdbAccessor.SUPPORTS_BLOB == null ||
      IdbAccessor.SUPPORTS_ARRAY_BUFFER == null
    ) {
      await this.initializeDB();
    }

    return new Promise<IDBDatabase>((resolve, reject) => {
      const onError = (ev: Event) => {
        const req = ev.target as IDBRequest;
        const db = req.result as IDBDatabase;
        db?.close();
        reject(`open failure (${req.error || ev}): ${dbName}`);
      };
      const request = indexedDB.open(dbName.replace(":", "_"));
      request.onerror = onError;
      request.onblocked = onError;
      request.onupgradeneeded = (ev) => {
        const request = ev.target as IDBRequest;
        const db = request.result;
        if (!db.objectStoreNames.contains(ENTRY_STORE)) {
          db.createObjectStore(ENTRY_STORE);
        }
        if (!db.objectStoreNames.contains(CONTENT_STORE)) {
          db.createObjectStore(CONTENT_STORE);
        }
      };
      request.onsuccess = (e) => {
        const db = (e.target as IDBRequest).result;
        resolve(db);
      };
    });
  }

  public async purge() {
    await this.drop();
  }

  public async saveFileNameIndex(dirPath: string) {
    const indexPath = await this.createIndexPath(dirPath);
    this.debug("saveFileNameIndex", indexPath);
    const fileNameIndex = this.dirPathIndex[dirPath];
    if (!fileNameIndex) {
      return;
    }
    const text = objectToText(fileNameIndex);
    const u8 = textToUint8Array(text);
    await this.doWriteContent(indexPath, u8);

    await this.doPutObject({
      fullPath: indexPath,
      name: INDEX_FILE_NAME,
      lastModified: Date.now(),
      size: getSize(u8),
    });
  }

  protected async doWriteArrayBuffer(
    fullPath: string,
    ab: ArrayBuffer
  ): Promise<void> {
    let content: Blob | Uint8Array | ArrayBuffer | string;
    if (IdbAccessor.SUPPORTS_ARRAY_BUFFER) {
      content = ab;
    } else if (IdbAccessor.SUPPORTS_BLOB) {
      content = await toBlob(ab);
    } else {
      content = await toBase64(ab);
    }
    await this.doWriteContentToIdb(fullPath, content);
  }

  protected async doWriteBase64(
    fullPath: string,
    base64: string
  ): Promise<void> {
    await this.doWriteContentToIdb(fullPath, base64);
  }

  protected async doWriteBlob(fullPath: string, blob: Blob): Promise<void> {
    let content: Blob | BufferSource | string;
    if (IdbAccessor.SUPPORTS_BLOB) {
      content = blob;
    } else if (IdbAccessor.SUPPORTS_ARRAY_BUFFER) {
      content = await toArrayBuffer(blob);
    } else {
      content = await toBase64(blob);
    }
    await this.doWriteContentToIdb(fullPath, content);
  }

  protected async doWriteBuffer(
    fullPath: string,
    buffer: Buffer
  ): Promise<void> {
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    );
    await this.doWriteArrayBuffer(fullPath, arrayBuffer);
  }

  private async doDeleteWithStore(storeName: string, fullPath: string) {
    await new Promise<void>(async (resolve, reject) => {
      const db = await this.open(this.dbName);
      const entryTx = db.transaction([storeName], "readwrite");
      const onError = (ev: Event) => {
        const req = ev.target as IDBRequest;
        db.close();
        reject(
          `doDeleteWithStore failure (${
            req.error || ev
          }): ${fullPath} of ${storeName}`
        );
      };
      entryTx.onabort = onError;
      entryTx.onerror = onError;
      entryTx.oncomplete = () => {
        db.close();
        resolve();
      };
      let range = IDBKeyRange.only(fullPath);
      const request = entryTx.objectStore(storeName).delete(range);
      request.onerror = onError;
    });
  }

  private doWriteContentToIdb(fullPath: string, content: any) {
    return new Promise<void>(async (resolve, reject) => {
      const db = await this.open(this.dbName);
      const contentTx = db.transaction([CONTENT_STORE], "readwrite");
      const onError = (ev: Event) => {
        db.close();
        reject(new InvalidModificationError(this.name, fullPath, ev));
      };
      contentTx.onabort = onError;
      contentTx.onerror = onError;
      contentTx.oncomplete = () => {
        db.close();
        resolve();
      };
      const contentReq = contentTx
        .objectStore(CONTENT_STORE)
        .put(content, fullPath);
      contentReq.onerror = onError;
    });
  }

  private drop() {
    return new Promise<void>(async (resolve) => {
      const dbName = this.dbName;
      const db = await this.open(dbName);
      const onError = (ev: Event) => {
        db.close();
        console.debug(ev); // Not Found
        resolve();
      };
      const request = indexedDB.deleteDatabase(dbName);
      request.onblocked = onError;
      request.onerror = onError;
      request.onsuccess = () => {
        db.close();
        resolve();
      };
    });
  }

  private async initializeDB() {
    await new Promise<void>((resolve, reject) => {
      const dbName = "blob-support";
      indexedDB.deleteDatabase(dbName).onsuccess = function () {
        const request = indexedDB.open(dbName, 1);
        const onError = (ev: Event) => {
          const req = ev.target as IDBRequest;
          const db = req.result as IDBDatabase;
          db?.close();
          reject(ev);
        };
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
        request.onerror = onError;
        request.onblocked = onError;
      };
    });
    await new Promise<void>((resolve, reject) => {
      const dbName = "arraybuffer-support";
      indexedDB.deleteDatabase(dbName).onsuccess = function () {
        const request = indexedDB.open(dbName, 1);
        const onError = (ev: Event) => {
          const req = ev.target as IDBRequest;
          const db = req.result as IDBDatabase;
          db?.close();
          reject(ev);
        };
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
        request.onerror = onError;
        request.onblocked = onError;
      };
    });
  }
}
