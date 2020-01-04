import { DIR_SEPARATOR } from "../FileSystemConstants";
import {
  DirectoryEntry,
  DirectoryEntryCallback,
  DirectoryReader,
  ErrorCallback,
  FileEntryCallback,
  Flags,
  VoidCallback
} from "../filesystem";
import { FileSystemObject } from "../FileSystemObject";
import { FileSystemParams } from "../FileSystemParams";
import { IdbDirectoryReader } from "./IdbDirectoryReader";
import { IdbEntry } from "./IdbEntry";
import { IdbFileEntry } from "./IdbFileEntry";
import { IdbFileSystem } from "./IdbFileSystem";
import { InvalidModificationError, NotFoundError } from "../FileError";
import { onError, resolveToFullPath } from "../FileSystemUtil";

export class IdbDirectoryEntry extends IdbEntry implements DirectoryEntry {
  public isFile = false;
  public isDirectory = true;

  constructor(params: FileSystemParams<IdbFileSystem>) {
    super(params);
  }

  createReader(): DirectoryReader {
    return new IdbDirectoryReader(this);
  }

  doCreateObject(
    isFile: boolean,
    path: string,
    successCallback: FileEntryCallback | DirectoryEntryCallback,
    errorCallback?: ErrorCallback
  ) {
    const newObj: FileSystemObject = {
      name: path.split(DIR_SEPARATOR).pop(),
      fullPath: path,
      lastModified: Date.now(),
      size: isFile ? 0 : null,
      hash: null
    };

    const idb = this.filesystem.idb;
    idb
      .put(newObj)
      .then(() => {
        if (isFile) {
          (successCallback as FileEntryCallback)(
            new IdbFileEntry({
              filesystem: this.filesystem,
              ...newObj
            })
          );
        } else {
          (successCallback as DirectoryEntryCallback)(
            new IdbDirectoryEntry({
              filesystem: this.filesystem,
              ...newObj
            })
          );
        }
      })
      .catch(err => {
        onError(err, errorCallback);
      });
  }

  getFile(
    path: string,
    options?: Flags | undefined,
    successCallback?: FileEntryCallback | undefined,
    errorCallback?: ErrorCallback | undefined
  ): void {
    path = resolveToFullPath(this.fullPath, path);
    const idb = this.filesystem.idb;
    idb
      .getEntry(path)
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
          successCallback(
            new IdbFileEntry({
              filesystem: this.filesystem,
              ...obj
            })
          );
        } else {
          if (options.create) {
            this.doCreateObject(true, path, successCallback, errorCallback);
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

  getDirectory(
    path: string,
    options?: Flags | undefined,
    successCallback?: DirectoryEntryCallback | undefined,
    errorCallback?: ErrorCallback | undefined
  ): void {
    // Create an absolute path if we were handed a relative one.
    path = resolveToFullPath(this.fullPath, path);

    const idb = this.filesystem.idb;
    idb
      .getEntry(path)
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

            this.doCreateObject(false, path, successCallback, errorCallback);
          } else {
            successCallback(
              new IdbDirectoryEntry({
                filesystem: this.filesystem,
                ...obj
              })
            );
          }
        } else {
          if (options.create) {
            this.doCreateObject(false, path, successCallback, errorCallback);
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
    const idb = this.filesystem.idb;
    idb
      .hasChild(this.fullPath)
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

        idb
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
    this.filesystem.idb
      .deleteRecursively(this.fullPath)
      .then(() => {
        successCallback();
      })
      .catch(err => {
        onError(err, errorCallback);
      });
  }
}
