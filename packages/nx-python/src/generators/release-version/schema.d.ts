import { ReleaseVersionGeneratorSchema } from 'nx/src/command-line/release/version-legacy';

export interface PythonReleaseVersionGeneratorSchema
  extends ReleaseVersionGeneratorSchema {
  lockArgs?: string;
}
