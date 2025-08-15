import { join } from 'path';
import { UVPyprojectToml } from '../../types';
import { copySync } from 'fs-extra';
import { existsSync, readdirSync } from 'fs';

export function includeDependencyPackage(
  projectData: UVPyprojectToml,
  projectRoot: string,
  buildFolderPath: string,
  buildTomlData: UVPyprojectToml,
  workspaceRoot: string,
) {
  const isTargetHatch =
    buildTomlData['build-system']['build-backend'] === 'hatchling.build';
  const isTargetUvBuild =
    buildTomlData['build-system']['build-backend'] === 'uv_build';

  const isTargetSrcDir = existsSync(join(buildFolderPath, 'src'));
  const isSrcDir = existsSync(join(workspaceRoot, projectRoot, 'src'));

  if (isTargetHatch) {
    buildTomlData.tool ??= {};
    buildTomlData.tool.hatch ??= {};
    buildTomlData.tool.hatch.build ??= {};
    buildTomlData.tool.hatch.build.targets ??= {};
    buildTomlData.tool.hatch.build.targets.wheel ??= {
      packages: getTargetModules(isTargetSrcDir),
    };
  } else if (isTargetUvBuild) {
    buildTomlData.tool ??= {};
    buildTomlData.tool.uv ??= {};
    buildTomlData.tool.uv['build-backend'] ??= {};
    buildTomlData.tool.uv['build-backend']['module-name'] =
      getTargetModules(false);
  } else {
    throw new Error(
      `Unsupported build system: ${buildTomlData['build-system']['build-backend']}, expected hatchling.build or uv_build`,
    );
  }

  if (isSrcDir) {
    for (const pkg of readdirSync(join(workspaceRoot, projectRoot, 'src'))) {
      const pkgFolder = join(workspaceRoot, projectRoot, 'src', pkg);
      copySync(pkgFolder, getTargetModulePath(pkg));

      updateModules(pkg);
    }
  } else {
    for (const pkg of projectData.tool?.hatch?.build?.targets?.wheel
      ?.packages ?? []) {
      const pkgFolder = join(workspaceRoot, projectRoot, pkg);
      copySync(pkgFolder, getTargetModulePath(pkg));

      updateModules(pkg);
    }
  }

  function getTargetModules(fullPath = false): string[] {
    return readdirSync(join(buildFolderPath, 'src')).map((pkg) =>
      fullPath ? `src/${pkg}` : pkg,
    );
  }

  function getTargetModulePath(pkg: string): string {
    return isTargetSrcDir
      ? join(buildFolderPath, 'src', pkg)
      : join(buildFolderPath, pkg);
  }

  function updateModules(pkg: string) {
    if (isTargetHatch) {
      const packages = buildTomlData.tool.hatch.build.targets.wheel.packages;
      const pkgName = isTargetSrcDir ? `src/${pkg}` : pkg;
      if (!packages.includes(pkgName)) {
        packages.push(pkgName);
      }
    } else if (isTargetUvBuild) {
      const moduleNames = buildTomlData.tool.uv['build-backend']['module-name'];
      if (!moduleNames.includes(pkg)) {
        moduleNames.push(pkg);
      }
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
