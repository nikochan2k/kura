import { AbstractEntry } from "./AbstractEntry";
import {
  DirectoryEntry,
  DirectoryEntryCallback,
  DirectoryReader,
  ErrorCallback,
  FileEntryCallback,
  FileSystem,
  Flags,
  VoidCallback
} from "./filesystem";
import { FileSystemObject } from "./FileSystemObject";
import { InvalidModificationError, NotFoundError } from "./FileError";
import { onError, resolveToFullPath } from "./FileSystemUtil";
import { FileSystemParams } from "./FileSystemParams";
import { AbstractEntrySupport } from "./AbstractEntrySupport";

export abstract class AbstractDirectoryEntry<T extends FileSystem>
  extends AbstractEntry<T>
  implements DirectoryEntry {
  isDirectory = true;
  isFile = false;

  constructor(params: FileSystemParams<T>, support: AbstractEntrySupport) {
    super(params, support);
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

        this.delete()
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
    errorCallback?: ErrorCallback
  ): void {
    throw new Error("Method not implemented."); // TODO
  }

  abstract createReader(): DirectoryReader;
  abstract async hasChild(): Promise<boolean>;
  abstract registerObject(
    path: string,
    isFile: boolean
  ): Promise<FileSystemObject>;
}
