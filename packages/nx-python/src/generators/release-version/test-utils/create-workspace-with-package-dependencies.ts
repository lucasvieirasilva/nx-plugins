import { ProjectGraph, Tree } from '@nx/devkit';
import { PyprojectToml } from '../../../graph/dependency-graph';
import path from 'path';
import { writePyprojectToml } from '../../../executors/utils/poetry';

interface ProjectAndPackageData {
  [projectName: string]: {
    projectRoot: string;
    packageName: string;
    version: string;
    pyprojectTomlPath: string;
    localDependencies: {
      projectName: string;
      dependencyCollection: 'dependencies' | string;
    }[];
  };
}

export function createWorkspaceWithPackageDependencies(
  tree: Tree,
  projectAndPackageData: ProjectAndPackageData,
): ProjectGraph {
  const projectGraph: ProjectGraph = {
    nodes: {},
    dependencies: {},
  };

  for (const [projectName, data] of Object.entries(projectAndPackageData)) {
    const pyprojectTomlContents = {
      tool: {
        poetry: {
          name: data.packageName,
          version: data.version,
        },
      },
    } as PyprojectToml;
    for (const dependency of data.localDependencies) {
      const dependencyPackageName =
        projectAndPackageData[dependency.projectName].packageName;

      if (dependency.dependencyCollection === 'dependencies') {
        pyprojectTomlContents.tool.poetry.dependencies ??= {};
        pyprojectTomlContents.tool.poetry.dependencies[dependencyPackageName] =
          {
            develop: true,
            path: path.relative(
              data.projectRoot,
              projectAndPackageData[dependency.projectName].projectRoot,
            ),
          };
      } else {
        pyprojectTomlContents.tool.poetry.group ??= {};
        pyprojectTomlContents.tool.poetry.group[
          dependency.dependencyCollection
        ] ??= {
          dependencies: {},
        };

        pyprojectTomlContents.tool.poetry.group[
          dependency.dependencyCollection
        ].dependencies[dependencyPackageName] = {
          develop: true,
          path: path.relative(
            data.projectRoot,
            projectAndPackageData[dependency.projectName].projectRoot,
          ),
        };
      }
    }
    // add the project and its nx project level dependencies to the projectGraph
    projectGraph.nodes[projectName] = {
      name: projectName,
      type: 'lib',
      data: {
        root: data.projectRoot,
      },
    };
    projectGraph.dependencies[projectName] = data.localDependencies.map(
      (dependency) => ({
        source: projectName,
        target: dependency.projectName,
        type: 'static',
      }),
    );
    // create the pyproject.toml in the tree
    writePyprojectToml(tree, data.pyprojectTomlPath, pyprojectTomlContents);
  }

  return projectGraph;
}
