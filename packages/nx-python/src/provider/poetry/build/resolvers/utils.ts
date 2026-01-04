import { join } from 'path';
import { copySync } from 'fs-extra';
import { PoetryPyprojectToml } from '../../types';

export function includeDependencyPackage(
  tomlData: PoetryPyprojectToml,
  root: string,
  buildFolderPath: string,
  buildTomlData: PoetryPyprojectToml,
) {
  for (const pkg of tomlData.tool.poetry.packages) {
    const pkgFolder = join(root, pkg.from ?? '', pkg.include);
    const buildPackageFolder = join(buildFolderPath, pkg.include);

    copySync(pkgFolder, buildPackageFolder);

    if (
      buildTomlData.tool.poetry.packages.find(
        (p) => p.include === pkg.include && p.from === pkg.from,
      )
    ) {
      continue;
    }

    buildTomlData.tool.poetry.packages.push({
      include: pkg.include,
    });
  }

  if (tomlData.tool.poetry.plugins) {
    if (!buildTomlData.tool.poetry.plugins) {
      buildTomlData.tool.poetry.plugins = {};
    }

    for (const pluginName in tomlData.tool.poetry.plugins) {
      buildTomlData.tool.poetry.plugins[pluginName] =
        tomlData.tool.poetry.plugins[pluginName];
    }
  }
}

/**
 * Sanitizes the provided package name to match what Poetry lists in the lockfile (underscores -> dashes)
 * @param packageName Package name to update
 * @returns Updated package name
 */
export function sanitizePackageName(packageName: string) {
  return packageName.replace(/_/g, '-');
}
