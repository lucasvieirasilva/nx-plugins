export interface PublishExecutorSchema {
  silent: boolean;
  buildTarget: string;
  dryRun: boolean;
  repository?: string;
  __unparsed__?: string[];
}
