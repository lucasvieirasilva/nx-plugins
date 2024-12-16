import { join } from 'path';
import chalk from 'chalk';
import { Logger } from '../../../../executors/utils/logger';
import { UVPyprojectToml } from '../../types';
import { UV_EXECUTABLE } from '../../utils';
import spawn from 'cross-spawn';
import { getPyprojectData } from '../../../utils';
import { PackageDependency } from '../../../base';
import { includeDependencyPackage } from './utils';
import { existsSync } from 'fs';

export class LockedDependencyResolver {
  constructor(private readonly logger: Logger) {}

  public resolve(
    projectRoot: string,
    buildFolderPath: string,
    buildTomlData: UVPyprojectToml,
    devDependencies: boolean,
    workspaceRoot: string,
  ): PackageDependency[] {
    const result: PackageDependency[] = [];
    this.logger.info(chalk`  Resolving dependencies...`);

    const requerimentsTxt = this.getProjectRequirementsTxt(
      devDependencies,
      projectRoot,
      workspaceRoot,
    );

    const requerimentsLines = requerimentsTxt.split('\n');
    for (const line of requerimentsLines) {
      if (!line.trim()) {
        continue;
      }

      if (line.startsWith('-e')) {
        const location = line.replace('-e', '').trim();
        const dependencyPyprojectPath = join(
          workspaceRoot,
          location,
          'pyproject.toml',
        );

        if (!existsSync(dependencyPyprojectPath)) {
          this.logger.info(
            chalk`    • Skipping local dependency {blue.bold ${location}} as pyproject.toml not found`,
          );
          continue;
        }

        const projectData = getPyprojectData<UVPyprojectToml>(
          dependencyPyprojectPath,
        );

        this.logger.info(
          chalk`    • Adding {blue.bold ${projectData.project.name}} local dependency`,
        );

        includeDependencyPackage(
          projectData,
          location,
          buildFolderPath,
          buildTomlData,
          workspaceRoot,
        );

        continue;
      }

      this.logger.info(
        chalk`    • Adding {blue.bold ${line.trim()}} dependency`,
      );

      result.push({
        name: line.trim(),
      });
    }

    return result;
  }

  private getProjectRequirementsTxt(
    devDependencies: boolean,
    projectRoot: string,
    workspaceRoot: string,
  ): string {
    const exportArgs = [
      'export',
      '--format',
      'requirements-txt',
      '--no-hashes',
      '--no-header',
      '--frozen',
      '--no-emit-project',
      '--all-extras',
      '--project',
      projectRoot,
    ];

    if (!devDependencies) {
      exportArgs.push('--no-dev');
    }

    const result = spawn.sync(UV_EXECUTABLE, exportArgs, {
      cwd: workspaceRoot,
      shell: true,
      stdio: 'pipe',
    });

    if (result.status !== 0) {
      throw new Error(
        chalk`{bold failed to export requirements txt with exit code {bold ${result.status}}`,
      );
    }

    return result.stdout.toString('utf-8');
  }
}
