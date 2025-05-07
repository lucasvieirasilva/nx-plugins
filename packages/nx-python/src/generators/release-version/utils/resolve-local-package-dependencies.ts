import {
  ProjectGraph,
  ProjectGraphDependency,
  ProjectGraphProjectNode,
  workspaceRoot,
} from '@nx/devkit';
import { satisfies } from 'semver';
import { Package } from './package';
import { BaseProvider } from '../../../provider/base';

export interface LocalPackageDependency extends ProjectGraphDependency {
  /**
   * The rawVersionSpec contains the value of the version spec as it was defined in the package.json
   * of the dependent project. This can be useful in cases where the version spec is a range, path or
   * workspace reference, and it needs to be be reverted to that original value as part of the release.
   */
  rawVersionSpec: string;
  groupKey?: string;
  dependencyCollection: 'dependencies' | string;
  // we don't currently manage peer dependencies
}

export function resolveLocalPackageDependencies(
  projectGraph: ProjectGraph,
  filteredProjects: ProjectGraphProjectNode[],
  projectNameToPackageRootMap: Map<string, string>,
  provider: BaseProvider,
  resolvePackageRoot: (projectNode: ProjectGraphProjectNode) => string,
  includeAll = false,
): Record<string, LocalPackageDependency[]> {
  const localPackageDependencies: Record<string, LocalPackageDependency[]> = {};
  const projectNodeToPackageMap = new Map<ProjectGraphProjectNode, Package>();

  const projects = includeAll
    ? Object.values(projectGraph.nodes)
    : filteredProjects;

  // Iterate through the projects being released and resolve any relevant package.json data
  for (const projectNode of projects) {
    // Resolve the package.json path for the project, taking into account any custom packageRoot settings
    let packageRoot = projectNameToPackageRootMap.get(projectNode.name);
    // packageRoot wasn't added to the map yet, try to resolve it dynamically
    if (!packageRoot && includeAll) {
      packageRoot = resolvePackageRoot(projectNode);
      if (!packageRoot) {
        continue;
      }
      // Append it to the map for later use within the release version generator
      projectNameToPackageRootMap.set(projectNode.name, packageRoot);
    }
    const pkg = new Package(provider, workspaceRoot, packageRoot);
    projectNodeToPackageMap.set(projectNode, pkg);
  }

  // populate local npm package dependencies
  for (const projectDeps of Object.values(projectGraph.dependencies)) {
    const workspaceDeps = projectDeps.filter(
      (dep) =>
        !isExternalNpmDependency(dep.target) &&
        !isExternalNpmDependency(dep.source),
    );
    for (const dep of workspaceDeps) {
      const source = projectGraph.nodes[dep.source];
      const target = projectGraph.nodes[dep.target];
      if (
        !source ||
        !projectNodeToPackageMap.has(source) ||
        !target ||
        !projectNodeToPackageMap.has(target)
      ) {
        // only relevant for dependencies between two workspace projects with Package objects
        continue;
      }

      const sourcePackage = projectNodeToPackageMap.get(source);
      const targetPackage = projectNodeToPackageMap.get(target);
      const sourcePoetryDependency = sourcePackage.getLocalDependency(
        targetPackage.name,
      );
      if (!sourcePoetryDependency) {
        continue;
      }

      const targetMatchesRequirement =
        // For file: and workspace: protocols the targetVersionSpec could be a path, so we check if it matches the target's location
        satisfies(targetPackage.version, targetPackage.version);

      if (targetMatchesRequirement) {
        // track only local package dependencies that are satisfied by the target's version
        localPackageDependencies[dep.source] = [
          ...(localPackageDependencies[dep.source] || []),
          {
            ...dep,
            groupKey: sourcePoetryDependency.groupKey,
            dependencyCollection: sourcePoetryDependency.collection,
            rawVersionSpec: sourcePoetryDependency.spec,
          },
        ];
      }
    }
  }

  return localPackageDependencies;
}

function isExternalNpmDependency(dep: string): boolean {
  return dep.startsWith('npm:');
}
