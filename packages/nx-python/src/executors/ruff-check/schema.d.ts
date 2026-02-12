import { BaseExecutorSchema } from '../base-schema';

export interface RuffCheckExecutorSchema extends BaseExecutorSchema {
  lintFilePatterns: string[];
  fix?: boolean;
  exitZero?: boolean;
  __unparsed__: string[];
}
