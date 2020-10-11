import { AbstractAccessor } from "./AbstractAccessor";
import { NotFoundError } from "./FileError";
import { INDEX_DIR } from "./FileSystemConstants";
import { FileSystemObject } from "./FileSystemObject";
import { ContentsCacheOptions } from "./FileSystemOptions";
import { getSize } from "./FileSystemUtil";

export interface ContentCacheEntry {
  access: number;
  content: Blob | Uint8Array | ArrayBuffer | string;
  lastModified: number;
  size: number;
}

export class ContentsCache {
  private cache: { [fullPath: string]: ContentCacheEntry } = {};
  private options: ContentsCacheOptions;

  constructor(accessor: AbstractAccessor) {
    this.options = accessor.options.contentsCacheOptions;
  }

  public async get(fullPath: string) {
    const entry = this.cache[fullPath];
    if (!entry) {
      return null;
    }

    entry.access = Date.now();
    return entry.content;
  }

  public put(
    obj: FileSystemObject,
    content: Blob | Uint8Array | ArrayBuffer | string
  ) {
    const fullPath = obj.fullPath;
    if (fullPath.startsWith(INDEX_DIR)) {
      return;
    }

    delete this.cache[fullPath];
    const size = getSize(content);
    if (size === 0 || this.options.limitSize < size) {
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
}
