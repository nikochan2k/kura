import { AbstractAccessor } from "./AbstractAccessor";
import { AbstractEntry } from "./AbstractEntry";
import {
  InvalidModificationError,
  NotFoundError,
  PathExistsError
} from "./FileError";
import {
  DirectoryEntry,
  DirectoryEntryCallback,
  DirectoryReader,
  Entry,
  EntryCallback,
  ErrorCallback,
  FileEntry,
  FileEntryCallback,
  Flags,
  VoidCallback
} from "./filesystem";
import { FileSystemObject } from "./FileSystemObject";
import { FileSystemParams } from "./FileSystemParams";
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
          const promises: Promise<Entry>[] = [];
          for (const entry of entries) {
            promises.push(
              new Promise<Entry>((resolve, reject) => {
                entry.copyTo(dirEntry, entry.name, resolve, reject);
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
    if (await this.hasChild()) {
      throw new InvalidModificationError(
        this.filesystem.name,
        this.fullPath,
        `${this.fullPath} is not empty`
      );
    }

    await accessor.delete(this.fullPath, false);
  }

  getDirectory(
    path: string,
    options?: Flags | undefined,
    successCallback?: DirectoryEntryCallback | undefined,
    errorCallback?: ErrorCallback | undefined
  ): void {
    const fullPath = resolveToFullPath(this.fullPath, path);
    if (fullPath === "/") {
      successCallback(this.filesystem.root);
      return;
    }

    this.getDirectoryObject(fullPath)
      .then(async obj => {
        if (!options) {
          options = {};
        }
        if (!successCallback) {
          successCallback = () => {};
        }

        if (obj) {
          if (obj.size != null) {
            onError(
              new PathExistsError(
                this.filesystem.name,
                fullPath,
                `${fullPath} is not a directory`
              ),
              errorCallback
            );
            return;
          }

          if (options.create) {
            if (options.exclusive) {
              onError(
                new PathExistsError(fullPath, `${fullPath} already exists`),
                errorCallback
              );
              return;
            }
          }
          successCallback(this.toDirectoryEntry(obj));
        } else {
          if (options.create) {
            this.registerObject(fullPath, false)
              .then(newObj => {
                successCallback(this.toDirectoryEntry(newObj));
              })
              .catch(err => {
                errorCallback(err);
              });
          } else {
            onError(
              new NotFoundError(this.filesystem.name, fullPath),
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
    const fullPath = resolveToFullPath(this.fullPath, path);
    this.getFileObject(fullPath)
      .then(async obj => {
        if (!options) {
          options = {};
        }
        if (!successCallback) {
          successCallback = () => {};
        }

        if (obj) {
          if (obj.size == null) {
            onError(
              new PathExistsError(
                this.filesystem.name,
                fullPath,
                `${fullPath} is not a file`
              ),
              errorCallback
            );
            return;
          }
          if (options.create) {
            if (options.exclusive) {
              onError(
                new PathExistsError(
                  this.filesystem.name,
                  fullPath,
                  `${fullPath} already exists`
                ),
                errorCallback
              );
              return;
            }
          }
          successCallback(this.toFileEntry(obj));
        } else {
          if (options.create) {
            this.registerObject(fullPath, true)
              .then(newObj => {
                successCallback(this.toFileEntry(newObj));
              })
              .catch(err => {
                errorCallback(err);
              });
          } else {
            onError(
              new NotFoundError(this.filesystem.name, fullPath),
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
          const promises: Promise<Entry>[] = [];
          for (const entry of entries) {
            promises.push(
              new Promise<Entry>((resolve, reject) => {
                entry.moveTo(dirEntry, entry.name, resolve, reject);
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
          .delete(this.fullPath, false)
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

  protected async hasChild(): Promise<boolean> {
    const objects = await this.params.accessor.getObjects(this.fullPath);
    return 0 < objects.length;
  }

  protected async registerObject(fullPath: string, isFile: boolean) {
    const accessor = this.params.accessor;
    let obj = await accessor.resetObject(fullPath);
    if (obj) {
      return obj;
    }
    obj = this.createObject(fullPath, isFile);
    await accessor.putObject(obj);
    return obj;
  }

  protected abstract toFileEntry(obj: FileSystemObject): FileEntry;
}
