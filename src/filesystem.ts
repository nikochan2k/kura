import { FileWriter, FileWriterAsync } from "./filewriter";

// Type definitions for File System API
// Project: http://www.w3.org/TR/file-system-api/
// Definitions by: Kon <http://phyzkit.net/>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

export interface LocalFileSystem {
  /**
   * Used for storage with no guarantee of persistence.
   */
  TEMPORARY: number;

  /**
   * Used for storage that should not be removed by the user agent without application or user permission.
   */
  PERSISTENT: number;

  /**
   * Requests a filesystem in which to store application data.
   * @param type Whether the filesystem requested should be persistent, as defined above. Use one of TEMPORARY or PERSISTENT.
   * @param size This is an indicator of how much storage space, in bytes, the application expects to need.
   * @param successCallback The callback that is called when the user agent provides a filesystem.
   * @param errorCallback A callback that is called when errors happen, or when the request to obtain the filesystem is denied.
   */
  requestFileSystem(
    type: number,
    size: number,
    successCallback: FileSystemCallback,
    errorCallback?: ErrorCallback
  ): void;

  /**
   * Allows the user to look up the Entry for a file or directory referred to by a local URL.
   * @param url A URL referring to a local file in a filesystem accessable via this API.
   * @param successCallback A callback that is called to report the Entry to which the supplied URL refers.
   * @param errorCallback A callback that is called when errors happen, or when the request to obtain the Entry is denied.
   */
  resolveLocalFileSystemURL(
    url: string,
    successCallback: EntryCallback,
    errorCallback?: ErrorCallback
  ): void;
}

export interface Metadata {
  /**
   * This is the time at which the file or directory was last modified.
   */
  modificationTime: Date;

  /**
   * The size of the file, in bytes. This must return 0 for directories.
   * @readonly
   */
  size: number;

  [key: string]: any;
}

export interface Flags {
  /**
   * Used to indicate that the user wants to create a file or directory if it was not previously there.
   */
  create?: boolean;

  /**
   * By itself, exclusive must have no effect. Used with create, it must cause getFile and getDirectory to fail if the target path already exists.
   */
  exclusive?: boolean;
}

/**
 * This interface represents a file system.
 */
export interface FileSystem {
  /**
   * This is the name of the file system. The specifics of naming filesystems is unspecified, but a name must be unique across the list of exposed file systems.
   * @readonly
   */
  name: string;

  /**
   * The root directory of the file system.
   * @readonly
   */
  root: DirectoryEntry;
}

export interface Entry {
  /**
   * Entry is a file.
   */
  isFile: boolean;

  /**
   * Entry is a directory.
   */
  isDirectory: boolean;

  /**
   * Look up metadata about this entry.
   * @param successCallback A callback that is called with the time of the last modification.
   * @param errorCallback ErrorCallback A callback that is called when errors happen.
   */
  getMetadata(
    successCallback: MetadataCallback,
    errorCallback?: ErrorCallback
  ): void;

  /**
   * Look up metadata about this entry.
   * @param metadata Metadata about this entry
   * @param successCallback A callback that is called on success.
   * @param errorCallback ErrorCallback A callback that is called when errors happen.
   */
  setMetadata(
    metadata: Metadata,
    successCallback: VoidCallback,
    errorCallback?: ErrorCallback
  ): void;

  /**
   * The name of the entry, excluding the path leading to it.
   */
  name: string;

  /**
   * The full absolute path from the root to the entry.
   */
  fullPath: string;

  /**
   * The file system on which the entry resides.
   */
  filesystem: FileSystem;

  /**
   * Move an entry to a different location on the file system. It is an error to try to:
   *
   * <ui>
   * <li>move a directory inside itself or to any child at any depth;</li>
   * <li>move an entry into its parent if a name different from its current one isn't provided;</li>
   * <li>move a file to a path occupied by a directory;</li>
   * <li>move a directory to a path occupied by a file;</li>
   * <li>move any element to a path occupied by a directory which is not empty.</li>
   * <ul>
   *
   * A move of a file on top of an existing file must attempt to delete and replace that file.
   * A move of a directory on top of an existing empty directory must attempt to delete and replace that directory.
   */
  moveTo(
    parent: DirectoryEntry,
    newName?: string,
    successCallback?: EntryCallback,
    errorCallback?: ErrorCallback
  ): void;

  /**
   * Copy an entry to a different location on the file system. It is an error to try to:
   *
   * <ul>
   * <li> copy a directory inside itself or to any child at any depth;</li>
   * <li> copy an entry into its parent if a name different from its current one isn't provided;</li>
   * <li> copy a file to a path occupied by a directory;</li>
   * <li> copy a directory to a path occupied by a file;</li>
   * <li> copy any element to a path occupied by a directory which is not empty.</li>
   * <li> A copy of a file on top of an existing file must attempt to delete and replace that file.</li>
   * <li> A copy of a directory on top of an existing empty directory must attempt to delete and replace that directory.</li>
   * </ul>
   *
   * Directory copies are always recursive--that is, they copy all contents of the directory.
   */
  copyTo(
    parent: DirectoryEntry,
    newName?: string,
    successCallback?: EntryCallback,
    errorCallback?: ErrorCallback
  ): void;

  /**
   * Returns a URL that can be used to identify this entry. Unlike the URN defined in [FILE-API-ED], it has no specific expiration; as it describes a location on disk, it should be valid at least as long as that location exists.
   */
  toURL(): string;

  /**
   * Deletes a file or directory. It is an error to attempt to delete a directory that is not empty. It is an error to attempt to delete the root directory of a filesystem.
   * @param successCallback A callback that is called on success.
   * @param errorCallback A callback that is called when errors happen.
   */
  remove(successCallback: VoidCallback, errorCallback?: ErrorCallback): void;

  /**
   * Look up the parent DirectoryEntry containing this Entry. If this Entry is the root of its filesystem, its parent is itself.
   * @param successCallback A callback that is called to return the parent Entry.
   * @param errorCallback A callback that is called when errors happen.
   */
  getParent(
    successCallback: DirectoryEntryCallback,
    errorCallback?: ErrorCallback
  ): void;
}

/**
 * This interface represents a directory on a file system.
 */
export interface DirectoryEntry extends Entry {
  /**
   * Creates a new DirectoryReader to read Entries from this Directory.
   */
  createReader(): DirectoryReader;

  /**
   * Creates or looks up a file.
   * @param path Either an absolute path or a relative path from this DirectoryEntry to the file to be looked up or created. It is an error to attempt to create a file whose immediate parent does not yet exist.
   * @param options
   *     <ul>
   *     <li>If create and exclusive are both true, and the path already exists, getFile must fail.</li>
   *     <li>If create is true, the path doesn't exist, and no other error occurs, getFile must create it as a zero-length file and return a corresponding FileEntry.</li>
   *     <li>If create is not true and the path doesn't exist, getFile must fail.</li>
   *     <li>If create is not true and the path exists, but is a directory, getFile must fail.</li>
   *     <li>Otherwise, if no other error occurs, getFile must return a FileEntry corresponding to path.</li>
   *     </ul>
   * @param successCallback A callback that is called to return the File selected or created.
   * @param errorCallback A callback that is called when errors happen.
   */
  getFile(
    path: string,
    options?: Flags,
    successCallback?: FileEntryCallback,
    errorCallback?: ErrorCallback
  ): void;

  /**
   * Creates or looks up a directory.
   * @param path Either an absolute path or a relative path from this DirectoryEntry to the directory to be looked up or created. It is an error to attempt to create a directory whose immediate parent does not yet exist.
   * @param options
   *     <ul>
   *     <li>If create and exclusive are both true and the path already exists, getDirectory must fail.</li>
   *     <li>If create is true, the path doesn't exist, and no other error occurs, getDirectory must create and return a corresponding DirectoryEntry.</li>
   *     <li>If create is not true and the path doesn't exist, getDirectory must fail.</li>
   *     <li>If create is not true and the path exists, but is a file, getDirectory must fail.</li>
   *     <li>Otherwise, if no other error occurs, getDirectory must return a DirectoryEntry corresponding to path.</li>
   *     </ul>
   * @param successCallback   A callback that is called to return the DirectoryEntry selected or created.
   * @param errorCallback A callback that is called when errors happen.
   *
   */
  getDirectory(
    path: string,
    options?: Flags,
    successCallback?: DirectoryEntryCallback,
    errorCallback?: ErrorCallback
  ): void;

  /**
   * Deletes a directory and all of its contents, if any. In the event of an error [e.g. trying to delete a directory that contains a file that cannot be removed], some of the contents of the directory may be deleted. It is an error to attempt to delete the root directory of a filesystem.
   * @param successCallback A callback that is called on success.
   * @param errorCallback A callback that is called when errors happen.
   */
  removeRecursively(
    successCallback: VoidCallback,
    errorCallback?: ErrorCallback
  ): void;
}

/**
 * This interface lets a user list files and directories in a directory. If there are no additions to or deletions from a directory between the first and last call to readEntries, and no errors occur, then:
 * <ul>
 * <li> A series of calls to readEntries must return each entry in the directory exactly once.</li>
 * <li> Once all entries have been returned, the next call to readEntries must produce an empty array.</li>
 * <li> If not all entries have been returned, the array produced by readEntries must not be empty.</li>
 * <li> The entries produced by readEntries must not include the directory itself ["."] or its parent [".."].</li>
 * </ul>
 */
export interface DirectoryReader {
  /**
   * Read the next block of entries from this directory.
   * @param successCallback Called once per successful call to readEntries to deliver the next previously-unreported set of Entries in the associated Directory. If all Entries have already been returned from previous invocations of readEntries, successCallback must be called with a zero-length array as an argument.
   * @param errorCallback A callback indicating that there was an error reading from the Directory.
   */
  readEntries(
    successCallback: EntriesCallback,
    errorCallback?: ErrorCallback
  ): void;
}

/**
 * This interface represents a file on a file system.
 */
export interface FileEntry extends Entry {
  /**
   * The size of the file.
   */
  size: number;

  /**
   * Creates a new FileWriter associated with the file that this FileEntry represents.
   * @param successCallback A callback that is called with the new FileWriter.
   * @param errorCallback A callback that is called when errors happen.
   */
  createWriter(
    successCallback: FileWriterCallback,
    errorCallback?: ErrorCallback
  ): void;

  /**
   * Returns a File that represents the current state of the file that this FileEntry represents.
   * @param successCallback A callback that is called with the File.
   * @param errorCallback A callback that is called when errors happen.
   */
  file(successCallback: FileCallback, errorCallback?: ErrorCallback): void;
}

/**
 * When requestFileSystem() succeeds, the following callback is made.
 */
export interface FileSystemCallback {
  /**
   * @param filesystem The file systems to which the app is granted access.
   */
  (filesystem: FileSystem): void;
}

/**
 * This interface is the callback used to look up Entry objects.
 */
export interface EntryCallback {
  /**
   * @param entry
   */
  (entry: Entry): void;
}

/**
 * This interface is the callback used to look up FileEntry objects.
 */
export interface FileEntryCallback {
  /**
   * @param entry
   */
  (entry: FileEntry): void;
}

/**
 * This interface is the callback used to look up DirectoryEntry objects.
 */
export interface DirectoryEntryCallback {
  /**
   * @param entry
   */
  (entry: DirectoryEntry): void;
}

/**
 * When readEntries() succeeds, the following callback is made.
 */
export interface EntriesCallback {
  (entries: Entry[]): void;
}

/**
 * This interface is the callback used to look up file and directory metadata.
 */
export interface MetadataCallback {
  (metadata: Metadata): void;
}

/**
 * This interface is the callback used to create a FileWriter.
 */
export interface FileWriterCallback {
  (fileWriter: FileWriter): void;
}

/**
 * This interface is the callback used to obtain a File.
 */
export interface FileCallback {
  (file: File): void;
}

/**
 * This interface is the generic callback used to indicate success of an asynchronous method.
 */
export interface VoidCallback {
  (): void;
}

/**
 * When an error occurs, the following callback is made.
 */
export interface ErrorCallback {
  (err: DOMError): void;
}

declare global {
  interface Window extends LocalFileSystem {
    mozIndexedDB: any;
    msIndexedDB: any;
    webkitRequestFileSystem: any;
  }
  interface WorkerGlobalScope extends LocalFileSystem {}
}
