import { BaseExecutorSchema } from '../base-schema';

export interface Flake8ExecutorSchema extends BaseExecutorSchema {
  outputFile: string;
  silent: boolean;
}
