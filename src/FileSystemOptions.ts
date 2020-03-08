import { Permission } from "./FileSystemIndex";

export interface FileSystemOptions {
  useIndex?: boolean;
  verbose?: boolean;
  permission?: Permission;
}
