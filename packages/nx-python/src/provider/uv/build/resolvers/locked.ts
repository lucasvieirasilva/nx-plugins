import path from 'path';
import chalk from 'chalk';
import { Logger } from '../../../../executors/utils/logger';
import { UVLockfile, UVLockfilePackage, UVPyprojectToml } from '../../types';
import { getUvLockfile, getUvVersion, UV_EXECUTABLE } from '../../utils';
import spawn from 'cross-spawn';
import { getLoggingTab, getPyprojectData } from '../../../utils';
import { PackageDependency } from '../../../base';
import {
  extractExtraFromDependencyName,
  includeDependencyPackage,
  normalizeDependencyName,
} from './utils';
import { existsSync } from 'fs';
import semver from 'semver';

const LOCK_FILE_NAME = 'uv.lock';

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
    const tab = getLoggingTab(1);
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
      buildTomlData.project.dependencies.push(dep.name);
    }

    if (
      Object.keys(buildTomlData.project?.['optional-dependencies'] ?? {})
        .length > 0
    ) {
      if (!this.lockFileExists(projectRoot, workspaceRoot)) {
        throw new Error(chalk`{bold uv.lock file not found`);
      }

      const lockData = getUvLockfile(
        this.isWorkspace
          ? path.join(workspaceRoot, LOCK_FILE_NAME)
          : path.join(projectRoot, LOCK_FILE_NAME),
      );

      if (!lockData) {
        throw new Error(chalk`{bold failed to get uv.lock file}`);
      }

      for (const extra in buildTomlData.project['optional-dependencies']) {
        const originalExtraDeps =
          buildTomlData.project['optional-dependencies'][extra];

        const lockedDeps = originalExtraDeps
          .map<
            [UVLockfilePackage, string[] | undefined]
          >((dep) => [lockData?.package[normalizeDependencyName(dep)], extractExtraFromDependencyName(dep)])
          .filter(([lockedPkgDep]) => lockedPkgDep);

        const resolvedDeps = this.resolveExtrasLockedDependencyTree(
          projectRoot,
          lockData,
          buildFolderPath,
          buildTomlData,
          workspaceRoot,
          lockedDeps,
          1,
          [],
          buildTomlData.project.dependencies.reduce(
            (acc, dep) => {
              acc[normalizeDependencyName(dep)] = true;
              return acc;
            },
            {} as Record<string, boolean>,
          ),
        );

        this.logger.info(
          chalk`${tab}• Extra: {blue.bold ${extra}} - {blue.bold ${resolvedDeps.join(
            ', ',
          )}} Locked Dependencies`,
        );

        buildTomlData.project['optional-dependencies'][extra] = resolvedDeps;
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
      return existsSync(path.join(workspaceRoot, LOCK_FILE_NAME));
    } else {
      return existsSync(path.join(projectRoot, LOCK_FILE_NAME));
    }
  }

  private resolveExtrasLockedDependencyTree(
    projectRoot: string,
    lockData: UVLockfile,
    buildFolderPath: string,
    buildTomlData: UVPyprojectToml,
    workspaceRoot: string,
    deps: [UVLockfilePackage, string[] | undefined][],
    level = 1,
    resolvedDeps: string[] = [],
    resolvedDepsMap: Record<string, boolean> = {},
  ): string[] {
    const tab = getLoggingTab(level);
    for (const [dep, extras] of deps) {
      this.logger.info(
        chalk`${tab}• Resolving dependency: {blue.bold ${dep.name}}`,
      );

      if (dep.source.editable) {
        const dependencyPath = this.isWorkspace
          ? dep.source.editable
          : path.relative(
              process.cwd(),
              path.resolve(projectRoot, dep.source.editable),
            );

        const dependencyPyprojectPath = path.join(
          dependencyPath,
          'pyproject.toml',
        );

        if (existsSync(dependencyPyprojectPath)) {
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
        }
      }

      if (!dep.source.editable && !resolvedDepsMap[dep.name]) {
        resolvedDeps.push(`${dep.name}==${dep.version}`);
        resolvedDepsMap[dep.name] = true;
      }

      dep.dependencies?.forEach((dep) => {
        if (
          !resolvedDepsMap[dep.name] &&
          lockData.package[dep.name] &&
          !lockData.package[dep.name].source?.editable
        ) {
          resolvedDeps.push(
            `${dep.name}==${lockData.package[dep.name].version}`,
          );
          resolvedDepsMap[dep.name] = true;
        }
      });

      if (extras && extras.length > 0) {
        for (const extra of extras) {
          const pkgDeps = dep['optional-dependencies']?.[extra]
            ?.map<
              [UVLockfilePackage, string[] | undefined]
            >((pkgDep) => [lockData.package[pkgDep.name], pkgDep.extra])
            .filter(([lockedPkgDep]) => lockedPkgDep);

          if (pkgDeps.length > 0) {
            pkgDeps.forEach(([pkgDep]) => {
              if (!resolvedDepsMap[pkgDep.name] && !pkgDep.source?.editable) {
                resolvedDeps.push(`${pkgDep.name}==${pkgDep.version}`);
                resolvedDepsMap[pkgDep.name] = true;
              }
            });

            this.logger.info(
              chalk`${tab}• Resolving extra: {blue.bold ${extra}} - {blue.bold ${pkgDeps
                .map(([pkgDep]) => pkgDep.name)
                .join(', ')}} Locked Dependencies`,
            );
          }

          this.resolveExtrasLockedDependencyTree(
            projectRoot,
            lockData,
            buildFolderPath,
            buildTomlData,
            workspaceRoot,
            pkgDeps,
            level,
            resolvedDeps,
            resolvedDepsMap,
          );
        }
      }
    }

    return resolvedDeps;
  }
}
