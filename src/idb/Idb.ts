import { countSlash, getRange } from "./IdbUtil";
import { createPath, getName, getParentPath } from "../FileSystemUtil";
import { DIR_SEPARATOR, INDEX_FILE_NAME } from "../FileSystemConstants";
import { FileSystemIndex } from "../FileSystemIndex";
import { FileSystemObject } from "../FileSystemObject";
import { IdbDirectoryEntry } from "./IdbDirectoryEntry";
import { IdbFileEntry } from "./IdbFileEntry";
import { IdbFileSystem } from "./IdbFileSystem";
import { InvalidModificationError, InvalidStateError } from "../FileError";

interface IndexAndObjects {
  index: FileSystemIndex;
  objects: FileSystemObject[];
}

const ENTRY_STORE = "entries";
const CONTENT_STORE = "contents";

const indexedDB: IDBFactory =
  window.indexedDB || window.mozIndexedDB || window.msIndexedDB;

export class Idb {
  static SUPPORTS_BLOB = true;

  private initialized = false;
  db: IDBDatabase;
  filesystem: IdbFileSystem;

  constructor(private useIndex: boolean) {
    this.filesystem = new IdbFileSystem(this);
  }

  private onError(this: any, ev: Event) {
    console.error(ev);
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
            const blob = new Blob(["test"], { type: "text/plain" });
            const transaction = db.transaction("store", "readwrite");
            transaction.objectStore("store").put(blob, "key");
            Idb.SUPPORTS_BLOB = true;
          } catch (err) {
            Idb.SUPPORTS_BLOB = false;
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
    if (!this.initialized) {
      await this.initialize();
      this.initialized = true;
    }

    const self = this;
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(dbName.replace(":", "_"));
      request.onupgradeneeded = function(ev) {
        const request = ev.target as IDBRequest;
        self.db = request.result;
        self.db.onerror = self.onError;

        if (!self.db.objectStoreNames.contains(ENTRY_STORE)) {
          self.db.createObjectStore(ENTRY_STORE);
        }
        if (!self.db.objectStoreNames.contains(CONTENT_STORE)) {
          self.db.createObjectStore(CONTENT_STORE);
        }
      };
      request.onsuccess = function(e) {
        self.db = (e.target as IDBRequest).result;
        self.db.onerror = self.onError;
        resolve();
      };
      const onerror = (ev: Event) => reject(ev);
      request.onerror = onerror;
      request.onblocked = onerror;
    });
  }

  close() {
    this.db.close();
    delete this.db;
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

  getEntry(fullPath: string) {
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

  getContent(fullPath: string) {
    return new Promise<any>((resolve, reject) => {
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

  getObjects(fullPath: string, recursive: boolean) {
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

          if (recursive || slashCount === countSlash(obj.fullPath)) {
            objects.push(obj);
          }

          cursor.continue();
        }
      };
      request.onerror = onerror;
    });
  }

  createEntries(objects: FileSystemObject[]) {
    return objects.map(obj => {
      return obj.size != null
        ? new IdbFileEntry({
            filesystem: this.filesystem,
            ...obj
          })
        : new IdbDirectoryEntry({
            filesystem: this.filesystem,
            ...obj
          });
    });
  }

  async getEntries(dirPath: string, recursive: boolean) {
    if (this.useIndex) {
      const objects = (await this.handleIndexAndObjects(dirPath)).objects;
      return this.createEntries(objects);
    }

    return this.createEntries(await this.getObjects(dirPath, recursive));
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
          await self.handleIndexAndObjects(
            dirPath,
            (index: FileSystemIndex, objects: FileSystemObject[]) => {
              let record = index[fullPath];
              if (record) {
                record.deleted = Date.now();
              }
              for (let i = 0, end = objects.length; i < end; i++) {
                if (objects[i].fullPath === fullPath) {
                  objects.splice(i);
                  break;
                }
              }
            }
          );
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
              const index = (await cursor.value) as FileSystemIndex;
              for (const record of Object.values(index)) {
                if (record.deleted == null) {
                  record.deleted = deleted;
                  updated = true;
                }
              }
              if (updated) {
                cursor.update(index);
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

  async handleIndexAndObjects(
    dirPath: string,
    update?: (index: FileSystemIndex, objects: FileSystemObject[]) => void
  ): Promise<IndexAndObjects> {
    if (!this.useIndex) {
      throw new InvalidStateError(this.filesystem.name, dirPath, "useIndex");
    }

    const indexPath = createPath(dirPath, INDEX_FILE_NAME);
    const index = (await this.getContent(indexPath)) as FileSystemIndex;

    if (index) {
      const objects: FileSystemObject[] = [];
      for (const record of Object.values(index)) {
        if (record.deleted == null) {
          objects.push(record.obj);
        }
      }
      if (update) {
        update(index, objects);
        await this.putContent(indexPath, index);
      }
      return { index: index, objects: objects };
    } else {
      const objects = await this.getObjects(dirPath, false);
      const index: FileSystemIndex = {};
      for (const obj of objects) {
        if (obj.name !== INDEX_FILE_NAME) {
          index[obj.fullPath] = { obj: obj, updated: obj.lastModified };
        }
      }
      if (update) {
        update(index, objects);
      }
      await this.putContent(indexPath, index);
      return { index: index, objects: objects };
    }
  }

  putContent(fullPath: string, content: any) {
    return new Promise<void>((resolve, reject) => {
      const contentTx = this.db.transaction([CONTENT_STORE], "readwrite");
      const onerror = (ev: Event) => reject(ev);
      contentTx.onabort = onerror;
      contentTx.onerror = onerror;
      contentTx.oncomplete = () => resolve();
      const contentReq = contentTx
        .objectStore(CONTENT_STORE)
        .put(content, fullPath);
      contentReq.onerror = onerror;
    });
  }

  putEntry(obj: FileSystemObject, content?: string | Blob) {
    return new Promise<void>((resolve, reject) => {
      if (this.useIndex && obj.name === INDEX_FILE_NAME) {
        reject(
          new InvalidModificationError(this.filesystem.name, obj.fullPath)
        );
        return;
      }

      const self = this;
      const entryTx = this.db.transaction([ENTRY_STORE], "readwrite");
      const onerror = (ev: Event) => reject(ev);
      entryTx.onabort = onerror;
      entryTx.onerror = onerror;
      entryTx.oncomplete = async function() {
        if (content) {
          await self.putContent(obj.fullPath, content);
        }
        if (self.useIndex) {
          const dirPath = getParentPath(obj.fullPath);
          await self.handleIndexAndObjects(
            dirPath,
            (index: FileSystemIndex, objects: FileSystemObject[]) => {
              let record = index[obj.fullPath];
              if (!record) {
                record = { obj: obj, updated: Date.now() };
                index[obj.fullPath] = record;
              } else {
                record.updated = Date.now();
              }
              delete record.deleted;
              objects.push(obj);
            }
          );
        }
        resolve();
      };
      const entryReq = entryTx.objectStore(ENTRY_STORE).put(obj, obj.fullPath);
      entryReq.onerror = onerror;
    });
  }
}
