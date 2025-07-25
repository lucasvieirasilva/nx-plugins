export interface ExecutorSchema {
  outputPath: string;
  outputSubdirectory?: string;
  outputType: 'folder' | 'zip';
  pythonVersion: string;
  abi: string;
  platform: string;
  distribution: 'wheel' | 'sdist';
  extras?: string[];
  ignorePatterns?: string[];
  ignoreDependencies?: string[];
}
