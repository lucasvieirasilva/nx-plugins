import { BaseExecutorSchema } from '../base-schema';

export interface ExecutorSchema extends BaseExecutorSchema {
  outputPath: string;
  outputType: 'folder' | 'zip';
  includeFiles?: {
    source: string;
    destination: string;
  }[];
  ignorePaths: string[];
}
