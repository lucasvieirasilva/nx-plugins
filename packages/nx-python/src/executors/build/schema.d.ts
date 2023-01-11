export interface BuildExecutorSchema {
  silent: boolean;
  ignorePaths: string[];
  outputPath: string;
  keepBuildFolder: boolean;
  devDependencies: boolean;
}
