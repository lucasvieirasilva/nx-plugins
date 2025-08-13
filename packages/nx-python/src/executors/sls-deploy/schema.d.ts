import { BaseExecutorSchema } from '../base-schema';

export interface ExecutorSchema extends BaseExecutorSchema {
  stage: string;
  verbose: boolean;
  force: boolean;
}
