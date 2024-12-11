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

export function getLoggingTab(level: number): string {
  return '    '.repeat(level);
}
