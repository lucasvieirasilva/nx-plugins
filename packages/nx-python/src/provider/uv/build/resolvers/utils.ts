import { join } from 'path';
import { UVPyprojectToml } from '../../types';
import { copySync } from 'fs-extra';

export function includeDependencyPackage(
  projectData: UVPyprojectToml,
  projectRoot: string,
  buildFolderPath: string,
  buildTomlData: UVPyprojectToml,
  workspaceRoot: string,
) {
  buildTomlData.tool ??= {};
  buildTomlData.tool.hatch ??= {};
  buildTomlData.tool.hatch.build ??= {};
  buildTomlData.tool.hatch.build.targets ??= {};
  buildTomlData.tool.hatch.build.targets.wheel ??= {
    packages: [],
  };

  const packages = buildTomlData.tool.hatch.build.targets.wheel.packages;
  for (const pkg of projectData.tool?.hatch?.build?.targets?.wheel?.packages ??
    []) {
    const pkgFolder = join(workspaceRoot, projectRoot, pkg);
    copySync(pkgFolder, join(buildFolderPath, pkg));

    if (!packages.includes(pkg)) {
      packages.push(pkg);
    }
  }
}

/**
 * Normalizes a dependency name by extracting the base package name.
 *
 * Removes version constraints, extras, and other specifications to get
 * just the package name. For example:
 * - "requests[security]>=2.25.0" -> "requests"
 * - "numpy" -> "numpy"
 *
 * @param dependency - The dependency string to normalize
 * @returns The normalized package name, or undefined if invalid
 */
export function normalizeDependencyName(
  dependency: string,
): string | undefined {
  const match = /^[a-zA-Z0-9-_]+/.exec(dependency);
  if (!match) {
    return undefined;
  }

  return match[0];
}

/**
 * Extracts extra specifications from a dependency name.
 *
 * Parses dependency strings like "package[extra1,extra2]" to extract
 * the list of extras: ["extra1", "extra2"]
 *
 * @param depName - The dependency name that may contain extras
 * @returns Array of extra names, empty if no extras found
 */
export function extractExtraFromDependencyName(
  depName: string | undefined,
): string[] {
  if (!depName) {
    return [];
  }

  return (
    depName
      .match(/\[(.*)\]/)?.[1]
      ?.split(',')
      ?.map((e) => e?.trim()) ?? []
  );
}
