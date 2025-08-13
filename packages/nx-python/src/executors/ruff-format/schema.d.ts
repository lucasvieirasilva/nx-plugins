import { BaseExecutorSchema } from '../base-schema';

export interface RuffFormatExecutorSchema extends BaseExecutorSchema {
  filePatterns: string[];
  check: boolean;
  __unparsed__: string[];
}
