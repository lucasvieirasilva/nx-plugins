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
  for (const pkg of projectData.tool?.hatch?.build?.targets?.wheel?.packages ??
    []) {
    const pkgFolder = join(workspaceRoot, projectRoot, pkg);
    copySync(pkgFolder, join(buildFolderPath, pkg));

    buildTomlData.tool ??= {};
    buildTomlData.tool.hatch ??= {};
    buildTomlData.tool.hatch.build ??= {};
    buildTomlData.tool.hatch.build.targets ??= {};
    buildTomlData.tool.hatch.build.targets.wheel ??= {
      packages: [],
    };
    buildTomlData.tool.hatch.build.targets.wheel.packages.push(pkg);
  }
}
