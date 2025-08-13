import { BaseExecutorSchema } from '../base-schema';

export interface AddExecutorSchema extends BaseExecutorSchema {
  name: string;
  local: boolean;
  args?: string;
  group?: string;
  extras?: string[];
}
