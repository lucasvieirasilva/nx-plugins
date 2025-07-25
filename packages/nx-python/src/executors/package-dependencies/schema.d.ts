export interface ExecutorSchema {
  outputPath: string;
  outputSubdirectory?: string;
  outputType: 'folder' | 'zip';
  platform: 'x86_64' | 'arm64';
  distribution: 'wheel' | 'sdist';
  extras?: string[];
  ignorePatterns?: string[];
  ignoreDependencies?: string[];
}
