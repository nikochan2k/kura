import { AbstractAccessor } from "../AbstractAccessor";
import {
  base64ToBlob,
  blobToBase64,
  blobToObject,
  createPath,
  getName,
  getParentPath,
  objectToBlob
} from "../FileSystemUtil";
import { countSlash, getRange } from "./IdbUtil";
import { DIR_SEPARATOR, INDEX_FILE_NAME } from "../FileSystemConstants";
import { FileSystemIndex } from "../FileSystemIndex";
import { FileSystemObject } from "../FileSystemObject";
import { IdbFileSystem } from "./IdbFileSystem";
import { InvalidModificationError, InvalidStateError } from "../FileError";

const ENTRY_STORE = "entries";
const CONTENT_STORE = "contents";

const indexedDB: IDBFactory =
  window.indexedDB || window.mozIndexedDB || window.msIndexedDB;

export class IdbAccessor extends AbstractAccessor {
  static SUPPORTS_BLOB: boolean;

  db: IDBDatabase;
  filesystem: IdbFileSystem;

  constructor(useIndex: boolean) {
    super(useIndex);
    this.filesystem = new IdbFileSystem(this);
  }

  get name() {
    return this.db.name;
  }

  close() {
    this.db.close();
    delete this.db;
  }

  delete(fullPath: string) {
    return new Promise<void>(async (resolve, reject) => {
      const self = this;
      const entryTx = this.db.transaction([ENTRY_STORE], "readwrite");
      const onerror = (ev: Event) => reject(ev);
      entryTx.onabort = onerror;
      entryTx.onerror = onerror;
      entryTx.oncomplete = async function(ev) {
        if (self.useIndex) {
          const dirPath = getParentPath(fullPath);
          await self.putIndex(dirPath, (index: FileSystemIndex) => {
            let record = index[fullPath];
            if (record) {
              record.deleted = Date.now();
            }
          });
        }

        resolve();
      };
      let range = IDBKeyRange.only(fullPath);
      const request = entryTx.objectStore(ENTRY_STORE).delete(range);
      request.onerror = onerror;
    });
  }

  deleteRecursively(fullPath: string) {
    return new Promise<void>((resolve, reject) => {
      const range = getRange(fullPath);

      const entryTx = this.db.transaction([ENTRY_STORE], "readwrite");
      const onerror = (ev: Event) => reject(ev);
      entryTx.onabort = onerror;
      entryTx.onerror = onerror;
      entryTx.oncomplete = function() {
        const deleted = Date.now();
        const contentTx = this.db.transaction([CONTENT_STORE], "readwrite");
        contentTx.onabort = onerror;
        contentTx.onerror = onerror;
        contentTx.oncomplete = () => resolve();
        const contentReq = contentTx
          .objectStore(CONTENT_STORE)
          .openCursor(range);
        contentReq.onerror = onerror;
        contentReq.onsuccess = async function(ev) {
          const cursor = <IDBCursorWithValue>(<IDBRequest>ev.target).result;
          if (cursor) {
            const fullPath = cursor.key.valueOf() as string;
            const name = getName(fullPath);
            if (name !== INDEX_FILE_NAME) {
              cursor.delete();
            } else {
              let updated = false;
              let blob: Blob;
              if (IdbAccessor.SUPPORTS_BLOB) {
                blob = cursor.value;
              } else {
                blob = base64ToBlob(cursor.value);
              }
              const index = (await blobToObject(blob)) as FileSystemIndex;
              for (const record of Object.values(index)) {
                if (record.deleted == null) {
                  record.deleted = deleted;
                  updated = true;
                }
              }
              if (updated) {
                blob = objectToBlob(index);
                let content: any;
                if (IdbAccessor.SUPPORTS_BLOB) {
                  content = blob;
                } else {
                  content = await blobToBase64(blob);
                }
                cursor.update(content);
              }
            }
            cursor.continue();
          }
        };
      };
      const entryReq = entryTx.objectStore(ENTRY_STORE).openCursor(range);
      entryReq.onsuccess = function(ev) {
        const cursor = <IDBCursorWithValue>(<IDBRequest>ev.target).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      entryReq.onerror = onerror;
    });
  }

  drop() {
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

  async getContent(fullPath: string) {
    const content = await this.doGetConent(fullPath);
    if (content == null) {
      return null;
    }
    return IdbAccessor.SUPPORTS_BLOB
      ? (content as Blob)
      : base64ToBlob(content as string);
  }

  getObject(fullPath: string) {
    return new Promise<FileSystemObject>((resolve, reject) => {
      const tx = this.db.transaction([ENTRY_STORE], "readonly");
      const range = IDBKeyRange.only(fullPath);
      const onerror = (ev: Event) => reject(ev);
      tx.onabort = onerror;
      tx.onerror = onerror;
      const request = tx.objectStore(ENTRY_STORE).get(range);
      tx.oncomplete = () => resolve(request.result);
      request.onerror = onerror;
    });
  }

  getObjectsFromDatabase(fullPath: string) {
    return new Promise<FileSystemObject[]>((resolve, reject) => {
      const tx = this.db.transaction([ENTRY_STORE], "readonly");
      const onerror = (ev: Event) => reject(ev);
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
      request.onsuccess = function(ev) {
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

  async getObjectsFromIndex(dirPath: string) {
    return await this.handleIndex(dirPath, true);
  }

  hasChild(fullPath: string) {
    return new Promise<boolean>((resolve, reject) => {
      const tx = this.db.transaction([ENTRY_STORE], "readonly");
      const onerror = (ev: Event) => reject(ev);
      tx.onabort = onerror;
      tx.onerror = onerror;
      let result = false;
      tx.oncomplete = () => resolve(result);

      const range = getRange(fullPath);
      const request = tx.objectStore(ENTRY_STORE).openCursor(range);
      request.onerror = onerror;
      request.onsuccess = function(ev) {
        const cursor = <IDBCursorWithValue>(<IDBRequest>ev.target).result;
        if (cursor) {
          result = true;
        }
      };
    });
  }

  initialize() {
    return new Promise((resolve, reject) => {
      const dbName = "blob-support";
      indexedDB.deleteDatabase(dbName).onsuccess = function() {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore("store");
        request.onsuccess = function() {
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
  }

  async open(dbName: string) {
    if (IdbAccessor.SUPPORTS_BLOB == null) {
      await this.initialize();
    }

    const self = this;
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(dbName.replace(":", "_"));
      const onError = (ev: Event) => {
        console.log(ev);
      };
      request.onupgradeneeded = function(ev) {
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
      request.onsuccess = function(e) {
        self.db = (e.target as IDBRequest).result;
        self.db.onerror = onError;
        resolve();
      };
      const onerror = (ev: Event) => reject(ev);
      request.onerror = onerror;
      request.onblocked = onerror;
    });
  }

  async putContent(fullPath: string, blob: Blob) {
    const content = IdbAccessor.SUPPORTS_BLOB ? blob : await blobToBase64(blob);
    await this.doPutContent(fullPath, content);
  }

  async putIndex(dirPath: string, update: (index: FileSystemIndex) => void) {
    await this.handleIndex(dirPath, false, update);
  }

  putObject(obj: FileSystemObject) {
    return new Promise<void>((resolve, reject) => {
      if (this.useIndex && obj.name === INDEX_FILE_NAME) {
        reject(new InvalidModificationError(this.name, obj.fullPath));
        return;
      }

      const self = this;
      const entryTx = this.db.transaction([ENTRY_STORE], "readwrite");
      const onerror = (ev: Event) => reject(ev);
      entryTx.onabort = onerror;
      entryTx.onerror = onerror;
      entryTx.oncomplete = async function() {
        if (self.useIndex) {
          const dirPath = getParentPath(obj.fullPath);
          await self.putIndex(dirPath, (index: FileSystemIndex) => {
            let record = index[obj.fullPath];
            if (!record) {
              record = { obj: obj, updated: Date.now() };
              index[obj.fullPath] = record;
            } else {
              record.updated = Date.now();
            }
            delete record.deleted;
          });
        }
        resolve();
      };
      const entryReq = entryTx.objectStore(ENTRY_STORE).put(obj, obj.fullPath);
      entryReq.onerror = onerror;
    });
  }

  private doGetConent(fullPath: string) {
    return new Promise<any>((resolve, reject) => {
      const onerror = (ev: Event) => reject(ev);
      const tx = this.db.transaction([CONTENT_STORE], "readonly");
      const range = IDBKeyRange.only(fullPath);
      tx.onabort = onerror;
      tx.onerror = onerror;
      const request = tx.objectStore(CONTENT_STORE).get(range);
      request.onerror = onerror;
      tx.oncomplete = function(ev) {
        if (request.result != null) {
          resolve(request.result);
        } else {
          resolve(null);
        }
      };
    });
  }

  private doPutContent(fullPath: string, content: any) {
    return new Promise<void>((resolve, reject) => {
      const contentTx = this.db.transaction([CONTENT_STORE], "readwrite");
      const onerror = (ev: Event) => reject(ev);
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

  private async handleIndex(
    dirPath: string,
    needObjects: boolean,
    update?: (index: FileSystemIndex) => void
  ) {
    if (!this.useIndex) {
      throw new InvalidStateError(this.name, dirPath, "useIndex");
    }

    const indexPath = createPath(dirPath, INDEX_FILE_NAME);
    const blob = await this.getContent(indexPath);
    const index = (await blobToObject(blob)) as FileSystemIndex;

    let objects: FileSystemObject[];
    if (index) {
      if (needObjects) {
        objects = [];
        for (const record of Object.values(index)) {
          if (record.deleted == null) {
            objects.push(record.obj);
          }
        }
      }
      if (update) {
        update(index);
        const blob = objectToBlob(index);
        await this.putContent(indexPath, blob);
      }
    } else {
      objects = await this.getObjectsFromDatabase(dirPath);
      const index: FileSystemIndex = {};
      for (const obj of objects) {
        if (obj.name !== INDEX_FILE_NAME) {
          index[obj.fullPath] = { obj: obj, updated: obj.lastModified };
        }
      }
      if (update) {
        update(index);
      }
      const blob = objectToBlob(index);
      await this.putContent(indexPath, blob);
    }
    return objects;
  }
}
