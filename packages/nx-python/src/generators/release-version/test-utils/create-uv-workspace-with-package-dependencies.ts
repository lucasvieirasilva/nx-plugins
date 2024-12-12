import { ProjectGraph, Tree } from '@nx/devkit';
import { UVPyprojectToml } from '../../../provider/uv/types';
import { writePyprojectToml } from '../../../provider/utils';
import toml from '@iarna/toml';
import path from 'path';

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

export function createUvWorkspaceWithPackageDependencies(
  tree: Tree,
  projectAndPackageData: ProjectAndPackageData,
): ProjectGraph {
  const projectGraph: ProjectGraph = {
    nodes: {},
    dependencies: {},
  };

  const uvLock = {
    package: [],
  };

  for (const [projectName, data] of Object.entries(projectAndPackageData)) {
    const lockData = {
      name: data.packageName,
      version: data.version,
      dependencies: [],
      'dev-dependencies': {},
      metadata: {
        'requires-dist': [],
        'requires-dev': {},
      },
    };
    uvLock.package.push(lockData);

    const pyprojectTomlContents = {
      project: {
        name: data.packageName,
        version: data.version,
      },
      tool: {
        uv: {
          sources: {},
        },
      },
    } as UVPyprojectToml;
    for (const dependency of data.localDependencies) {
      const dependencyPackageName =
        projectAndPackageData[dependency.projectName].packageName;

      pyprojectTomlContents.tool.uv.sources ??= {};

      pyprojectTomlContents.tool.uv.sources[dependencyPackageName] = {
        workspace: true,
      };

      if (dependency.dependencyCollection === 'dependencies') {
        pyprojectTomlContents.project.dependencies ??= [];
        pyprojectTomlContents.project.dependencies.push(dependencyPackageName);

        lockData.metadata['requires-dist'].push({
          name: dependencyPackageName,
          specifier: '*',
          editable: projectAndPackageData[dependency.projectName].projectRoot,
        });
        lockData.dependencies.push({ name: dependencyPackageName });
      } else {
        pyprojectTomlContents['dependency-groups'] ??= {};
        pyprojectTomlContents['dependency-groups'][
          dependency.dependencyCollection
        ] ??= [];

        pyprojectTomlContents['dependency-groups'][
          dependency.dependencyCollection
        ].push(dependencyPackageName);

        lockData.metadata['requires-dev'][dependency.dependencyCollection] ??=
          [];
        lockData.metadata['requires-dev'][dependency.dependencyCollection].push(
          {
            name: dependencyPackageName,
            specifier: '*',
            editable: projectAndPackageData[dependency.projectName].projectRoot,
          },
        );

        lockData['dev-dependencies'][dependency.dependencyCollection] ??= [];
        lockData['dev-dependencies'][dependency.dependencyCollection].push({
          name: dependencyPackageName,
        });
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

  tree.write(path.join(tree.root, 'uv.lock'), toml.stringify(uvLock));

  return projectGraph;
}
