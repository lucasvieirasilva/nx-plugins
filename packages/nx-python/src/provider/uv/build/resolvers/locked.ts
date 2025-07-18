import path from 'path';
import chalk from 'chalk';
import { Logger } from '../../../../executors/utils/logger';
import { UVPyprojectToml } from '../../types';
import { getUvVersion, UV_EXECUTABLE } from '../../utils';
import spawn from 'cross-spawn';
import { getPyprojectData } from '../../../utils';
import { PackageDependency } from '../../../base';
import { includeDependencyPackage } from './utils';
import { existsSync } from 'fs';
import semver from 'semver';

export class LockedDependencyResolver {
  constructor(
    private readonly logger: Logger,
    private readonly isWorkspace: boolean,
  ) {}

  public apply(
    projectRoot: string,
    buildFolderPath: string,
    buildTomlData: UVPyprojectToml,
    devDependencies: boolean,
    workspaceRoot: string,
  ): UVPyprojectToml {
    const result: PackageDependency[] = [];
    this.logger.info(chalk`  Resolving dependencies...`);

    const requirementsTxt = this.getProjectRequirementsTxt(
      devDependencies,
      projectRoot,
      workspaceRoot,
    );

    const requirementsLines = requirementsTxt.split('\n');
    for (const line of requirementsLines) {
      if (!line.trim()) {
        continue;
      }

      if (line.startsWith('-e') || line.startsWith('.')) {
        const location = line.replace('-e', '').trim();
        const dependencyPath = this.isWorkspace
          ? location
          : path.relative(process.cwd(), path.resolve(projectRoot, location));

        const dependencyPyprojectPath = path.join(
          dependencyPath,
          'pyproject.toml',
        );

        if (!existsSync(dependencyPyprojectPath)) {
          this.logger.info(
            chalk`    • Skipping local dependency {blue.bold ${dependencyPath}} as pyproject.toml not found`,
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
          dependencyPath,
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

    buildTomlData.project.dependencies = [];
    buildTomlData['dependency-groups'] = {};

    if (buildTomlData.tool?.uv?.sources) {
      buildTomlData.tool.uv.sources = {};
    }

    for (const dep of result) {
      if (dep.version) {
        buildTomlData.project.dependencies.push(`${dep.name}==${dep.version}`);
      } else {
        buildTomlData.project.dependencies.push(dep.name);
      }

      if (dep.source) {
        buildTomlData.tool.uv.sources[dep.name] = {
          index: dep.source,
        };
      }
    }

    return buildTomlData;
  }

  private getProjectRequirementsTxt(
    devDependencies: boolean,
    projectRoot: string,
    workspaceRoot: string,
  ): string {
    const uvVersion = getUvVersion();
    const noAnnotateSupported = semver.gte(uvVersion, '0.6.11'); // --no-annotate only supported from 0.6.11

    const exportArgs = [
      'export',
      '--format',
      'requirements-txt',
      '--no-hashes',
      '--no-header',
      ...(noAnnotateSupported ? ['--no-annotate'] : []),
      '--frozen',
      '--no-emit-project',
      '--all-extras',
      '--project',
      projectRoot,
    ];

    if (!devDependencies) {
      exportArgs.push('--no-dev');
    }

    if (!this.lockFileExists(projectRoot, workspaceRoot)) {
      this.logger.info('  Generating uv.lock file');
      const lockCmd = spawn.sync(UV_EXECUTABLE, ['lock'], {
        cwd: projectRoot,
        shell: true,
        stdio: 'inherit',
      });

      if (lockCmd.status !== 0) {
        throw new Error(
          chalk`{bold failed to generate uv.lock file with exit code {bold ${lockCmd.status}}}`,
        );
      }
    }

    const result = spawn.sync(UV_EXECUTABLE, exportArgs, {
      cwd: workspaceRoot,
      shell: true,
      stdio: 'pipe',
    });

    if (result.status !== 0) {
      throw new Error(
        chalk`{bold failed to export requirements txt with exit code {bold ${result.status}}}`,
      );
    }

    return result.stdout.toString('utf-8');
  }

  private lockFileExists(projectRoot: string, workspaceRoot: string): boolean {
    if (this.isWorkspace) {
      return existsSync(path.join(workspaceRoot, 'uv.lock'));
    } else {
      return existsSync(path.join(projectRoot, 'uv.lock'));
    }
  }
}
