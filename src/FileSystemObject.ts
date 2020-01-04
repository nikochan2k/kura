export interface FileSystemObject {
  name: string;
  fullPath: string;
  lastModified: number;
  size: number;
  [key: string]: any;
}
