import { joinPathFragments, Tree } from '@nx/devkit';
import {
  PyprojectToml,
  PyprojectTomlDependencies,
} from '../../../graph/dependency-graph';
import { readPyprojectToml } from '../../../executors/utils/poetry';

export class Package {
  name: string;
  version: string;
  location: string;

  constructor(
    private tree: Tree,
    private pyprojectToml: PyprojectToml,
    workspaceRoot: string,
    private workspaceRelativeLocation: string,
  ) {
    this.name = pyprojectToml.tool.poetry.name;
    this.version = pyprojectToml.tool.poetry.version;
    this.location = joinPathFragments(workspaceRoot, workspaceRelativeLocation);
  }

  getLocalDependency(depName: string): {
    collection: 'dependencies' | 'devDependencies' | 'optionalDependencies';
    groupKey?: string;
    spec: string;
  } | null {
    if (this.pyprojectToml.tool?.poetry?.dependencies?.[depName]) {
      return {
        collection: 'dependencies',
        spec: extractDependencyVersion(
          this.tree,
          this.workspaceRelativeLocation,
          this.pyprojectToml.tool?.poetry?.dependencies,
          depName,
        ),
      };
    }

    for (const groupKey of Object.keys(
      this.pyprojectToml.tool?.poetry?.group,
    )) {
      if (
        this.pyprojectToml.tool?.poetry?.group[groupKey]?.dependencies?.[
          depName
        ]
      ) {
        return {
          collection:
            groupKey === 'dev' ? 'devDependencies' : 'optionalDependencies',
          groupKey,
          spec: extractDependencyVersion(
            this.tree,
            this.workspaceRelativeLocation,
            this.pyprojectToml.tool?.poetry?.group[groupKey]?.dependencies,
            depName,
          ),
        };
      }
    }

    return null;
  }
}

export function extractDependencyVersion(
  tree: Tree,
  projectLocation: string,
  dependencyGroup: PyprojectTomlDependencies,
  depName: string,
): string {
  if (typeof dependencyGroup?.[depName] === 'string') {
    return dependencyGroup?.[depName];
  }

  const dependentPyproject = readPyprojectToml(
    tree,
    joinPathFragments(
      projectLocation,
      dependencyGroup?.[depName].path,
      'pyproject.toml',
    ),
  );

  return dependentPyproject.tool.poetry.version;
}
