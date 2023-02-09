import { PyprojectTomlDependency } from '../../../graph/dependency-graph';

export type Dependency = {
  name: string;
  version: string;
  markers?: string;
  optional: boolean;
  extras?: string[];
  git?: string;
  rev?: string;
  source?: string;
};

export type PoetryLockPackage = {
  name: string;
  version: string;
  category: string;
  optional: boolean;
  dependencies?: {
    [key: string]: PyprojectTomlDependency;
  };
  source?: {
    type: 'git' | 'directory' | 'file' | 'url';
    url?: string;
    reference?: string;
  };
};

export type PoetryLock = {
  package: PoetryLockPackage[];
};
