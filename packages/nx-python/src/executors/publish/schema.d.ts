import { BaseExecutorSchema } from '../base-schema';

export interface PublishExecutorSchema extends BaseExecutorSchema {
  silent: boolean;
  buildTarget: string;
  dryRun: boolean;
  repository?: string;
  __unparsed__?: string[];
}
