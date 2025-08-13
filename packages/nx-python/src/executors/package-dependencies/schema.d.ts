import { BaseExecutorSchema } from '../base-schema';

export interface ExecutorSchema extends BaseExecutorSchema {
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
