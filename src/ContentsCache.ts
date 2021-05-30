import { AbstractAccessor } from "./AbstractAccessor";
import { INDEX_DIR } from "./FileSystemConstants";
import { FileSystemObject } from "./FileSystemObject";
import { ContentsCacheOptions } from "./FileSystemOptions";
import { getMemorySize } from "./FileSystemUtil";

export interface ContentCacheEntry {
  // #region Properties (4)

  access: number;
  content: Blob | Uint8Array | ArrayBuffer | string;
  lastModified: number;
  size: number;

  // #endregion Properties (4)
}

export class ContentsCache {
  // #region Properties (2)

  private cache: { [fullPath: string]: ContentCacheEntry } = {};
  private options: ContentsCacheOptions;

  // #endregion Properties (2)

  // #region Constructors (1)

  constructor(accessor: AbstractAccessor) {
    this.options = accessor.options.contentsCacheOptions;
  }

  // #endregion Constructors (1)

  // #region Public Methods (4)

  public clear() {
    this.cache = {};
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
    const size = getMemorySize(content);
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

  // #endregion Public Methods (4)
}
