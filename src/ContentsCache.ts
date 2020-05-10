import { AbstractAccessor } from "./AbstractAccessor";
import { DIR_SEPARATOR, INDEX_FILE_PATH } from "./FileSystemConstants";
import { FileSystemObject } from "./FileSystemObject";
import { ContentsCacheOptions } from "./FileSystemOptions";
import { getSize } from "./FileSystemUtil";
import { NotFoundError } from "./FileError";

export interface ContentCacheEntry {
  access: number;
  content: Blob | Uint8Array | ArrayBuffer | string;
  lastModified: number;
  size: number;
}

export class ContentsCache {
  private cache: { [fullPath: string]: ContentCacheEntry } = {};
  private options: ContentsCacheOptions;
  private shared: boolean;

  constructor(private accessor: AbstractAccessor) {
    this.shared = accessor.options.shared;
    this.options = accessor.options.contentsCacheOptions;
  }

  public async get(fullPath: string) {
    const entry = this.cache[fullPath];
    if (!entry) {
      return null;
    }

    if (this.shared) {
      try {
        const obj = await this.accessor.doGetObject(fullPath);
        if (entry.lastModified !== obj.lastModified) {
          return null;
        }
      } catch (e) {
        if (e instanceof NotFoundError) {
          delete this.cache[fullPath];
        }
        throw e;
      }
    }

    entry.access = Date.now();
    return entry.content;
  }

  public put(
    obj: FileSystemObject,
    content: Blob | Uint8Array | ArrayBuffer | string
  ) {
    const fullPath = obj.fullPath;
    if (fullPath === INDEX_FILE_PATH) {
      return;
    }

    const size = getSize(content);
    if (this.options.limitSize < size) {
      return;
    }

    const capacity = this.options.capacity;

    let sum = 0;
    const list: { fullPath: string; size: number; access: number }[] = [];
    for (const [fullPath, entry] of Object.entries(this.cache)) {
      sum += entry.size;
      list.push({ fullPath, size: entry.size, access: entry.access });
    }

    let current = sum + size;
    if (current <= capacity) {
      this.cache[fullPath] = {
        content,
        size,
        lastModified: obj.lastModified,
        access: Date.now(),
      };
      return;
    }
    list.sort((a, b) => {
      return b.access - a.access;
    });

    const limit = capacity - size;
    for (const item of list) {
      delete this.cache[item.fullPath];
      current -= item.size;
      if (current <= limit) {
        break;
      }
    }

    this.cache[fullPath] = {
      content,
      size,
      lastModified: obj.lastModified,
      access: Date.now(),
    };
  }

  public remove(fullPath: string) {
    delete this.cache[fullPath];
  }

  public removeBy(startsWith: string) {
    if (!startsWith || startsWith === DIR_SEPARATOR) {
      this.cache = {};
      return;
    }
    const dirPrefix = startsWith + DIR_SEPARATOR;
    for (const fullPath of Object.keys(this.cache)) {
      if (fullPath === startsWith || fullPath.startsWith(dirPrefix)) {
        delete this.cache[fullPath];
      }
    }
  }
}
