import { countSlash, getRange } from "./IdbUtil";
import { DIR_SEPARATOR, INDEX_FILE_NAME } from "../FileSystemConstants";
import { FileSystemIndex } from "../FileSystemIndex";
import { FileSystemObject } from "../FileSystemObject";
import { IdbDirectoryEntry } from "./IdbDirectoryEntry";
import { IdbFileEntry } from "./IdbFileEntry";
import { IdbFileSystem } from "./IdbFileSystem";
import { InvalidModificationError, InvalidStateError } from "../FileError";
import {
  createPath,
  dataToString,
  getParentPath,
  getName
} from "../FileSystemUtil";

interface Ret {
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
          resolve(null);
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

  getObjects(fullPath: string, recursive: boolean) {
    return new Promise<FileSystemObject[]>((resolve, reject) => {
      const tx = this.db.transaction([ENTRY_STORE], "readonly");
      tx.onabort = function(ev) {
        reject(ev);
      };
      tx.onerror = function(ev) {
        reject(ev);
      };
      const objects: FileSystemObject[] = [];
      tx.oncomplete = function() {
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
      request.onerror = function(ev) {
        reject(ev);
      };
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
      return (await this.getIndex(dirPath)).objects;
    }

    return this.createEntries(await this.getObjects(dirPath, recursive));
  }

  delete(fullPath: string) {
    return new Promise<void>(async (resolve, reject) => {
      const dirPath = getParentPath(fullPath);
      let index: FileSystemIndex;
      if (this.useIndex) {
        index = (await this.getIndex(dirPath)).index;
      }
      const self = this;
      const tx = this.db.transaction([ENTRY_STORE], "readwrite");
      tx.onabort = function(ev) {
        reject(ev);
      };
      tx.oncomplete = function(ev) {
        if (index) {
          const record = index[fullPath];
          if (record && record.deleted == null) {
            record.deleted = Date.now();
            self
              .putIndexJson(dirPath, index)
              .then(() => {
                resolve();
              })
              .catch(err => {
                reject(err);
              });
          } else {
            resolve();
          }
        } else {
          resolve();
        }
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
      const self = this;
      const range = getRange(fullPath);

      const entryTx = this.db.transaction([ENTRY_STORE], "readwrite");
      entryTx.onabort = function(ev) {
        reject(ev);
      };
      entryTx.onerror = function(ev) {
        reject(ev);
      };
      entryTx.oncomplete = function() {
        const contentTx = this.db.transaction([CONTENT_STORE], "readwrite");
        contentTx.onabort = function(ev) {
          reject(ev);
        };
        contentTx.onerror = function(ev) {
          reject(ev);
        };
        const indexPathes: string[] = [];
        contentTx.oncomplete = function() {
          const promises: Promise<FileSystemIndex>[] = [];
          for (const indexPath of indexPathes) {
            promises.push(self.getIndexJson(indexPath));
          }
          const deleted = Date.now();
          Promise.all(promises).then(async indexes => {
            let i = 0;
            for (const index of indexes) {
              const indexPath = indexPathes[i];
              for (const record of Object.values(index)) {
                record.deleted = deleted;
              }
              await self.putIndexJson(indexPath, index);
              i++;
            }
            console.log("resolve");
            resolve();
          });
        };
        const contentReq = contentTx
          .objectStore(CONTENT_STORE)
          .openCursor(range);
        contentReq.onerror = function(ev) {
          reject(ev);
        };
        contentReq.onsuccess = async function(ev) {
          const cursor = <IDBCursorWithValue>(<IDBRequest>ev.target).result;
          if (cursor) {
            const fullPath = cursor.key.valueOf() as string;
            const name = getName(fullPath);
            if (name !== INDEX_FILE_NAME) {
              cursor.delete();
            } else {
              indexPathes.push(fullPath);
            }
            cursor.continue();
          }
        };
      };
      const entryReq = entryTx.objectStore(ENTRY_STORE).openCursor(range);
      entryReq.onerror = function(ev) {
        reject(ev);
      };
      entryReq.onsuccess = function(ev) {
        const cursor = <IDBCursorWithValue>(<IDBRequest>ev.target).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
    });
  }

  private async getIndexJson(indexPath: string) {
    const data = await this.getContent(indexPath);
    if (data == null) {
      return null;
    }
    let text = await dataToString(data);
    return JSON.parse(text) as FileSystemIndex;
  }

  private async putIndexJson(indexPath: string, index: FileSystemIndex) {
    return new Promise<void>((resolve, reject) => {
      const contentTx = this.db.transaction([CONTENT_STORE], "readwrite");
      contentTx.onabort = function(ev) {
        reject(ev);
      };
      contentTx.onerror = function(ev) {
        reject(ev);
      };
      contentTx.oncomplete = function() {
        resolve();
      };
      const text = JSON.stringify(index);
      const contentReq = contentTx
        .objectStore(CONTENT_STORE)
        .put(Idb.SUPPORTS_BLOB ? new Blob([text]) : text, indexPath);
      contentReq.onerror = function(ev) {
        reject(ev);
      };
    });
  }

  async getIndex(dirPath: string) {
    return await this.putIndex(dirPath, true);
  }

  async putIndex(
    dirPath: string,
    needEntries: boolean,
    objToAdd?: FileSystemObject
  ): Promise<Ret> {
    if (!this.useIndex) {
      throw new InvalidStateError(this.filesystem.name, dirPath, "useIndex");
    }

    const indexPath = createPath(dirPath, INDEX_FILE_NAME);
    const index = await this.getIndexJson(indexPath);
    const handle = (objects: FileSystemObject[], index: FileSystemIndex) => {
      let record = index[objToAdd.fullPath];
      if (!record) {
        record = { obj: objToAdd, updated: Date.now() };
        index[objToAdd.fullPath] = record;
      } else {
        record.updated = Date.now();
      }
      objects.push(objToAdd);
    };
    if (index) {
      const objects: FileSystemObject[] = [];
      for (const record of Object.values(index)) {
        if (record.deleted == null) {
          objects.push(record.obj);
        }
      }
      if (objToAdd) {
        handle(objects, index);
        await this.putIndexJson(createPath(dirPath, INDEX_FILE_NAME), index);
      }
      return needEntries
        ? { index: index, objects: this.createEntries(objects) }
        : { index: index, objects: null };
    } else {
      const objects = await this.getObjects(dirPath, false);
      const index: FileSystemIndex = {};
      for (const obj of objects) {
        if (obj.name !== INDEX_FILE_NAME) {
          index[obj.fullPath] = { obj: obj, updated: obj.lastModified };
        }
      }
      if (objToAdd) {
        handle(objects, index);
      }
      await this.putIndexJson(createPath(dirPath, INDEX_FILE_NAME), index);
      return needEntries
        ? { index: index, objects: this.createEntries(objects) }
        : { index: index, objects: null };
    }
  }

  put(obj: FileSystemObject, content?: string | Blob) {
    const self = this;
    return new Promise<FileSystemObject>((resolve, reject) => {
      if (this.useIndex && obj.name === INDEX_FILE_NAME) {
        reject(
          new InvalidModificationError(this.filesystem.name, obj.fullPath)
        );
        return;
      }

      const entryTx = this.db.transaction([ENTRY_STORE], "readwrite");
      entryTx.onabort = function(ev) {
        reject(ev);
      };
      entryTx.onerror = function(ev) {
        reject(ev);
      };
      entryTx.oncomplete = function() {
        const parentDir = getParentPath(obj.fullPath);
        const handle = () => {
          if (self.useIndex) {
            self
              .putIndex(parentDir, false, obj)
              .then(() => {
                resolve(obj);
              })
              .catch(err => {
                reject(err);
              });
          } else {
            resolve(obj);
          }
        };
        if (content) {
          const contentTx = this.db.transaction([CONTENT_STORE], "readwrite");
          contentTx.onabort = function(ev) {
            reject(ev);
          };
          contentTx.onerror = function(ev) {
            reject(ev);
          };
          contentTx.oncomplete = function() {
            handle();
          };
          const contentReq = contentTx
            .objectStore(CONTENT_STORE)
            .put(content, obj.fullPath);
          contentReq.onerror = function(ev) {
            reject(ev);
          };
        } else {
          handle();
        }
      };
      const entryReq = entryTx.objectStore(ENTRY_STORE).put(obj, obj.fullPath);
      entryReq.onerror = function(ev) {
        reject(ev);
      };
    });
  }
}
