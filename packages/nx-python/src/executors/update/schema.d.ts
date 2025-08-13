import { BaseExecutorSchema } from '../base-schema';

export interface UpdateExecutorSchema extends BaseExecutorSchema {
  name?: string;
  local: boolean;
  args?: string;
}
