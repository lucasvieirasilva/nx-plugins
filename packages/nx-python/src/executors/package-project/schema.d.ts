export interface ExecutorSchema {
  outputPath: string;
  outputType: 'folder' | 'zip';
  includeFiles?: {
    source: string;
    destination: string;
  }[];
  ignorePaths: string[];
}
