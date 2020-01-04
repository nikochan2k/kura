import { countSlash, getRange } from "./IdbUtil";
import { DIR_SEPARATOR, EMPTY_BLOB } from "../FileSystemConstants";
import { FileSystemObject } from "../FileSystemObject";
import { IdbDirectoryEntry } from "./IdbDirectoryEntry";
import { IdbEntry } from "./IdbEntry";
import { IdbFileEntry } from "./IdbFileEntry";
import { IdbFileSystem } from "./IdbFileSystem";

const ENTRY_STORE = "entries";
const CONTENT_STORE = "contents";

const indexedDB: IDBFactory =
  window.indexedDB || window.mozIndexedDB || window.msIndexedDB;

export class Idb {
  static SUPPORTS_BLOB = true;

  private initialized = false;
  db: IDBDatabase;
  filesystem: IdbFileSystem;

  constructor() {
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
        request.onupgradeneeded = function() {
          request.result.createObjectStore("store");
        };
        request.onerror = function() {
          reject();
        };
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
      request.onerror = function(ev) {
        reject(ev);
      };
      request.onblocked = function(ev) {
        reject(ev);
      };
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
      request.onerror = function(ev) {
        reject(ev);
      };
      request.onsuccess = function(ev) {
        resolve();
      };

      this.close();
    });
  }

  getEntry(fullPath: string) {
    return new Promise<FileSystemObject>((resolve, reject) => {
      const tx = this.db.transaction([ENTRY_STORE], "readonly");
      const range = IDBKeyRange.only(fullPath);
      tx.onabort = function(ev) {
        reject(ev);
      };
      tx.onerror = function(ev) {
        reject(ev);
      };
      const request = tx.objectStore(ENTRY_STORE).get(range);
      request.onerror = function(ev) {
        reject(ev);
      };
      tx.oncomplete = function() {
        resolve(request.result);
      };
    });
  }

  getContent(fullPath: string) {
    return new Promise<string | Blob>((resolve, reject) => {
      const tx = this.db.transaction([CONTENT_STORE], "readonly");
      const range = IDBKeyRange.only(fullPath);
      tx.onabort = function(ev) {
        reject(ev);
      };
      tx.onerror = function(ev) {
        reject(ev);
      };
      const request = tx.objectStore(CONTENT_STORE).get(range);
      request.onerror = function(ev) {
        reject(ev);
      };
      tx.oncomplete = function(ev) {
        if (request.result != null) {
          resolve(request.result);
        } else {
          resolve(Idb.SUPPORTS_BLOB ? EMPTY_BLOB : "");
        }
      };
    });
  }

  hasChild(fullPath: string) {
    return new Promise<boolean>((resolve, reject) => {
      const tx = this.db.transaction([ENTRY_STORE], "readonly");
      tx.onabort = function(ev) {
        reject(ev);
      };
      tx.onerror = function(ev) {
        reject(ev);
      };
      let result = false;
      tx.oncomplete = function() {
        resolve(result);
      };

      const range = getRange(fullPath);
      const request = tx.objectStore(ENTRY_STORE).openCursor(range);
      request.onerror = function(ev) {
        reject(ev);
      };
      request.onsuccess = function(ev) {
        const cursor = <IDBCursorWithValue>(<IDBRequest>ev.target).result;
        if (cursor) {
          result = true;
        }
      };
    });
  }

  getEntries(fullPath: string, recursive: boolean) {
    return new Promise<IdbEntry[]>((resolve, reject) => {
      const tx = this.db.transaction([ENTRY_STORE], "readonly");
      tx.onabort = function(ev) {
        reject(ev);
      };
      tx.onerror = function(ev) {
        reject(ev);
      };
      let entries: IdbEntry[] = [];
      tx.oncomplete = function() {
        resolve(entries);
      };

      const filesystem = this.filesystem;
      let slashCount: number;
      if (fullPath === DIR_SEPARATOR) {
        slashCount = 1;
      } else {
        slashCount = countSlash(fullPath) + 1; // + 1 is the last slash for directory
      }
      const range = getRange(fullPath);
      const request = tx.objectStore(ENTRY_STORE).openCursor(range);
      request.onerror = function(ev) {
        reject(ev);
      };
      request.onsuccess = function(ev) {
        const cursor = <IDBCursorWithValue>(<IDBRequest>ev.target).result;
        if (cursor) {
          const obj = cursor.value as FileSystemObject;

          if (recursive || slashCount === countSlash(obj.fullPath)) {
            entries.push(
              obj.size != null
                ? new IdbFileEntry({
                    filesystem: filesystem,
                    ...obj
                  })
                : new IdbDirectoryEntry({
                    filesystem: filesystem,
                    ...obj
                  })
            );
          }

          cursor.continue();
        }
      };
    });
  }

  delete(fullPath: string) {
    return new Promise<void>((resolve, reject) => {
      const tx = this.db.transaction([ENTRY_STORE], "readwrite");
      tx.onabort = function(ev) {
        reject(ev);
      };
      tx.oncomplete = function(ev) {
        resolve();
      };
      let range = IDBKeyRange.only(fullPath);
      const request = tx.objectStore(ENTRY_STORE).delete(range);
      request.onerror = function(ev) {
        reject(ev);
      };
    });
  }

  deleteRecursively(fullPath: string) {
    return new Promise<void>((resolve, reject) => {
      const tx = this.db.transaction([ENTRY_STORE], "readwrite");
      tx.onabort = function(ev) {
        reject(ev);
      };
      tx.onerror = function(ev) {
        reject(ev);
      };
      tx.oncomplete = function() {
        resolve();
      };

      const range = getRange(fullPath);
      const request = tx.objectStore(ENTRY_STORE).openCursor(range);
      request.onerror = function(ev) {
        reject(ev);
      };
      request.onsuccess = function(ev) {
        const cursor = <IDBCursorWithValue>(<IDBRequest>ev.target).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
    });
  }

  put(obj: FileSystemObject, content?: string | Blob) {
    return new Promise<FileSystemObject>((resolve, reject) => {
      let tx = this.db.transaction([ENTRY_STORE], "readwrite");
      tx.onabort = function(ev) {
        reject(ev);
      };
      tx.onerror = function(ev) {
        reject(ev);
      };
      tx.oncomplete = function() {
        if (content) {
          tx = this.db.transaction([CONTENT_STORE], "readwrite");
          tx.onabort = function(ev) {
            reject(ev);
          };
          tx.onerror = function(ev) {
            reject(ev);
          };
          tx.oncomplete = function() {
            resolve(obj);
          };
          const contentReq = tx
            .objectStore(CONTENT_STORE)
            .put(content, obj.fullPath);
          contentReq.onerror = function(ev) {
            reject(ev);
          };
        } else {
          resolve(obj);
        }
      };
      const entryReq = tx.objectStore(ENTRY_STORE).put(obj, obj.fullPath);
      entryReq.onerror = function(ev) {
        reject(ev);
      };
    });
  }
}
