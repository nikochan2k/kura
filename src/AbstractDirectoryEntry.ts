import { AbstractAccessor } from "./AbstractAccessor";
import { AbstractEntry } from "./AbstractEntry";
import {
  DirectoryEntry,
  DirectoryEntryCallback,
  DirectoryReader,
  EntryCallback,
  ErrorCallback,
  FileEntry,
  FileEntryCallback,
  Flags,
  VoidCallback
} from "./filesystem";
import { FileSystemObject } from "./FileSystemObject";
import { FileSystemParams } from "./FileSystemParams";
import { InvalidModificationError, NotFoundError } from "./FileError";
import { onError, resolveToFullPath } from "./FileSystemUtil";

export abstract class AbstractDirectoryEntry<T extends AbstractAccessor>
  extends AbstractEntry<T>
  implements DirectoryEntry {
  isDirectory = true;
  isFile = false;

  constructor(params: FileSystemParams<T>) {
    super(params);
  }

  copyTo(
    parent: DirectoryEntry,
    newName?: string | undefined,
    successCallback?: EntryCallback | undefined,
    errorCallback?: ErrorCallback | undefined
  ): void {
    if (!this.canCopy(parent, newName, errorCallback)) {
      return;
    }

    parent.getDirectory(
      newName || this.name,
      { create: true },
      dirEntry => {
        const reader = this.createReader();
        reader.readEntries(entries => {
          const promises: Promise<void>[] = [];
          for (const entry of entries) {
            promises.push(
              new Promise<void>((resolve, reject) => {
                entry.copyTo(dirEntry, entry.name, () => resolve, reject);
              })
            );
          }
          Promise.all(promises)
            .then(() => {
              successCallback(dirEntry);
            })
            .catch(errors => {
              onError(errors, errorCallback);
            });
        }, errorCallback);
      },
      errorCallback
    );
  }

  async delete() {
    const accessor = this.params.accessor;
    if (await accessor.hasChild(this.fullPath)) {
      throw new InvalidModificationError(
        this.filesystem.name,
        this.fullPath,
        `${this.fullPath} is not empty`
      );
    }

    await accessor.delete(this.fullPath);
  }

  getDirectory(
    path: string,
    options?: Flags | undefined,
    successCallback?: DirectoryEntryCallback | undefined,
    errorCallback?: ErrorCallback | undefined
  ): void {
    path = resolveToFullPath(this.fullPath, path);

    this.getDirectoryObject(path)
      .then(obj => {
        if (!options) {
          options = {};
        }
        if (!successCallback) {
          successCallback = () => {};
        }

        if (obj) {
          if (obj.size != null) {
            onError(
              new InvalidModificationError(
                this.filesystem.name,
                path,
                `${path} is not a directory`
              ),
              errorCallback
            );
            return;
          }

          if (options.create) {
            if (options.exclusive) {
              onError(
                new InvalidModificationError(path, `${path} already exists`),
                errorCallback
              );
              return;
            }
          }
          successCallback(this.toDirectoryEntry(obj));
        } else {
          if (options.create) {
            this.registerObject(path, false)
              .then(obj => {
                successCallback(this.toDirectoryEntry(obj));
              })
              .catch(err => {
                errorCallback(err);
              });
          } else {
            onError(
              new NotFoundError(this.filesystem.name, path),
              errorCallback
            );
          }
        }
      })
      .catch(err => {
        onError(err, errorCallback);
      });
  }

  getDirectoryObject(path: string): Promise<FileSystemObject> {
    return this.params.accessor.getObject(path);
  }

  getFile(
    path: string,
    options?: Flags,
    successCallback?: FileEntryCallback,
    errorCallback?: ErrorCallback
  ): void {
    path = resolveToFullPath(this.fullPath, path);
    this.getFileObject(path)
      .then(obj => {
        if (!options) {
          options = {};
        }
        if (!successCallback) {
          successCallback = () => {};
        }

        if (obj) {
          if (obj.size == null) {
            onError(
              new InvalidModificationError(
                this.filesystem.name,
                path,
                `${path} is not a file`
              ),
              errorCallback
            );
            return;
          }
          if (options.create && options.exclusive) {
            onError(
              new InvalidModificationError(
                this.filesystem.name,
                path,
                `${path} already exists`
              ),
              errorCallback
            );
            return;
          }
          successCallback(this.toFileEntry(obj));
        } else {
          if (options.create) {
            this.registerObject(path, true)
              .then(obj => {
                successCallback(this.toFileEntry(obj));
              })
              .catch(err => {
                errorCallback(err);
              });
          } else {
            onError(
              new NotFoundError(this.filesystem.name, path),
              errorCallback
            );
          }
        }
      })
      .catch(err => {
        onError(err, errorCallback);
      });
  }

  getFileObject(path: string): Promise<FileSystemObject> {
    return this.params.accessor.getObject(path);
  }

  protected hasChild(): Promise<boolean> {
    return this.params.accessor.hasChild(this.fullPath);
  }

  moveTo(
    parent: DirectoryEntry,
    newName?: string | undefined,
    successCallback?: EntryCallback | undefined,
    errorCallback?: ErrorCallback | undefined
  ): void {
    if (!this.canCopy(parent, newName, errorCallback)) {
      return;
    }

    parent.getDirectory(
      newName || this.name,
      { create: true },
      dirEntry => {
        const reader = this.createReader();
        reader.readEntries(entries => {
          const promises: Promise<void>[] = [];
          for (const entry of entries) {
            promises.push(
              new Promise<void>((resolve, reject) => {
                entry.moveTo(dirEntry, entry.name, () => resolve, reject);
              })
            );
          }
          Promise.all(promises)
            .then(() => {
              successCallback(dirEntry);
            })
            .catch(errors => {
              onError(errors, errorCallback);
            });
        }, errorCallback);
      },
      errorCallback
    );
  }

  protected async registerObject(path: string, isFile: boolean) {
    const obj = this.createObject(path, isFile);
    const accessor = this.params.accessor;
    await accessor.putObject(obj);
    return obj;
  }

  remove(
    successCallback: VoidCallback,
    errorCallback?: ErrorCallback | undefined
  ): void {
    this.hasChild()
      .then(result => {
        if (result) {
          onError(
            new InvalidModificationError(
              this.filesystem.name,
              this.fullPath,
              `${this.fullPath} is not empty`
            ),
            errorCallback
          );
          return;
        }

        this.params.accessor
          .delete(this.fullPath)
          .then(() => {
            successCallback();
          })
          .catch(err => {
            onError(err, errorCallback);
          });
      })
      .catch(err => {
        onError(err, errorCallback);
      });
  }

  removeRecursively(
    successCallback: VoidCallback,
    errorCallback?: ErrorCallback | undefined
  ): void {
    this.params.accessor
      .deleteRecursively(this.fullPath)
      .then(() => {
        successCallback();
      })
      .catch(err => {
        onError(err, errorCallback);
      });
  }

  abstract createReader(): DirectoryReader;

  protected abstract toFileEntry(obj: FileSystemObject): FileEntry;
}
