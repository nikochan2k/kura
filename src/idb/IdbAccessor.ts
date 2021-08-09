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
  // #region Properties (4)

  private static SUPPORTS_ARRAY_BUFFER: boolean;
  private static SUPPORTS_BLOB: boolean;

  public db: IDBDatabase;
  public filesystem: IdbFileSystem;

  // #endregion Properties (4)

  // #region Constructors (1)

  constructor(private dbName: string, options: FileSystemOptions) {
    super(options);
    this.filesystem = new IdbFileSystem(this);
  }

  // #endregion Constructors (1)

  // #region Public Accessors (1)

  public get name() {
    return this.dbName;
  }

  // #endregion Public Accessors (1)

  // #region Public Methods (10)

  public async doDelete(fullPath: string, isFile: boolean) {
    await new Promise<void>(async (resolve) => {
      const entryTx = this.db.transaction([ENTRY_STORE], "readwrite");
      const onerror = (ev: Event) => {
        const req = ev.target as IDBRequest;
        this.debug(`doDelete failure (${req.error})`, fullPath);
        resolve();
      };
      entryTx.onabort = onerror;
      entryTx.onerror = onerror;
      entryTx.oncomplete = () => {
        resolve();
      };
      let range = IDBKeyRange.only(fullPath);
      const request = entryTx.objectStore(ENTRY_STORE).delete(range);
      request.onerror = onerror;
    });
    await new Promise<void>(async (resolve) => {
      const entryTx = this.db.transaction([CONTENT_STORE], "readwrite");
      const onerror = (ev: Event) => {
        const req = ev.target as IDBRequest;
        this.debug(`doDelete failure (${req.error})`, fullPath);
        resolve();
      };
      entryTx.onabort = onerror;
      entryTx.onerror = onerror;
      entryTx.oncomplete = () => {
        resolve();
      };
      let range = IDBKeyRange.only(fullPath);
      const request = entryTx.objectStore(CONTENT_STORE).delete(range);
      request.onerror = onerror;
    });
  }

  public doGetObject(fullPath: string) {
    return new Promise<FileSystemObject>((resolve, reject) => {
      const tx = this.db.transaction([ENTRY_STORE], "readonly");
      const range = IDBKeyRange.only(fullPath);
      const onerror = (ev: Event) => {
        const req = ev.target as IDBRequest;
        reject(new NotFoundError(this.name, fullPath, req.error));
      };
      tx.onabort = onerror;
      tx.onerror = onerror;
      const request = tx.objectStore(ENTRY_STORE).get(range);
      tx.oncomplete = () => {
        if (request.result != null) {
          resolve(request.result);
        } else {
          reject(new NotFoundError(this.name, fullPath));
        }
      };
      request.onerror = onerror;
    });
  }

  public doGetObjects(fullPath: string) {
    return new Promise<FileSystemObject[]>((resolve, reject) => {
      const tx = this.db.transaction([ENTRY_STORE], "readonly");
      const onerror = (ev: Event) => {
        const req = ev.target as IDBRequest;
        reject(new NotFoundError(this.name, fullPath, req.error));
      };
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

  public doMakeDirectory(obj: FileSystemObject) {
    return this.doPutObject(obj);
  }

  public doPutObject(obj: FileSystemObject) {
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

  public doReadContent(
    fullPath: string
  ): Promise<Blob | BufferSource | string> {
    return new Promise<any>((resolve, reject) => {
      const onerror = (ev: Event) => {
        const req = ev.target as IDBRequest;
        reject(new NotFoundError(this.name, fullPath, req.error));
      };
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

    const self = this;
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(dbName.replace(":", "_"));
      const onError = (ev: Event) => {
        const req = ev.target as IDBRequest;
        this.debug(`open failure (${req.error})`, dbName);
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

  public async purge() {
    await this.drop();
    await this.open(this.dbName);
  }

  public async saveFileNameIndex(dirPath: string) {
    const indexPath = await this.createIndexPath(dirPath);
    this.debug("saveFileNameIndex", indexPath);
    const fileNameIndex = this.dirPathIndex[dirPath];
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

  // #endregion Public Methods (10)

  // #region Protected Methods (5)

  protected close() {
    this.db.close();
    delete this.db;
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

  // #endregion Protected Methods (5)

  // #region Private Methods (3)

  private doWriteContentToIdb(fullPath: string, content: any) {
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

  private drop() {
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

  private async initializeDB() {
    await new Promise<void>((resolve, reject) => {
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
    await new Promise<void>((resolve, reject) => {
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

  // #endregion Private Methods (3)
}
