import { BaseExecutorSchema } from '../base-schema';

export interface ExecutorSchema extends BaseExecutorSchema {
  stage: string;
}
