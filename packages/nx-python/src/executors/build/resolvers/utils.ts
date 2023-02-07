import { join } from 'path';
import { copySync } from 'fs-extra';
import { PyprojectToml } from '../../../graph/dependency-graph';

export function includeDependencyPackage(
  tomlData: PyprojectToml,
  root: string,
  buildFolderPath: string,
  buildTomlData: PyprojectToml
) {
  for (const pkg of tomlData.tool.poetry.packages) {
    const pkgFolder = join(root, pkg.include);
    const buildPackageFolder = join(buildFolderPath, pkg.include);

    copySync(pkgFolder, buildPackageFolder, { recursive: true });

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
