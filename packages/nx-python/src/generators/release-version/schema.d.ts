import { ReleaseVersionGeneratorSchema } from 'nx/src/command-line/release/version';

export interface PythonReleaseVersionGeneratorSchema
  extends ReleaseVersionGeneratorSchema {
  lockArgs?: string;
}
