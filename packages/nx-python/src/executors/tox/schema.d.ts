import { BaseExecutorSchema } from '../base-schema';

export interface ToxExecutorSchema extends BaseExecutorSchema {
  silent: boolean;
  args?: string;
}
