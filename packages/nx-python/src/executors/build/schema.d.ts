export interface BuildExecutorSchema {
  silent: boolean;
  ignorePaths: string[];
  outputPath: string;
  keepBuildFolder: boolean;
  devDependencies: boolean;
  lockedVersions: boolean;
  bundleLocalDependencies: boolean;
  customSourceName?: string;
  customSourceUrl?: string;
  publish?: boolean;
}

export interface BuildExecutorOutput {
  buildFolderPath: string;
  success: boolean;
}
