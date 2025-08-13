import { BaseExecutorSchema } from '../base-schema';

export interface RemoveExecutorSchema extends BaseExecutorSchema {
  name: string;
  local: boolean;
  args?: string;
}
