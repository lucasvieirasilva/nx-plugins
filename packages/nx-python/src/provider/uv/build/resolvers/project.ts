import chalk from 'chalk';
import path from 'path';
import { existsSync } from 'fs-extra';
import { UVLockfile, UVPyprojectToml, UVPyprojectTomlIndex } from '../../types';
import { Logger } from '../../../../executors/utils/logger';
import { PackageDependency } from '../../../base';
import { getLoggingTab, getPyprojectData } from '../../../utils';
import { getUvLockfile } from '../../utils';
import { includeDependencyPackage } from './utils';
import { BuildExecutorSchema } from '../../../../executors/build/schema';
import { ExecutorContext } from '@nx/devkit';
import { createHash } from 'crypto';

export class ProjectDependencyResolver {
  private rootUvLock: UVLockfile | null = null;

  constructor(
    private readonly logger: Logger,
    private readonly options: BuildExecutorSchema,
    private readonly context: ExecutorContext,
    private readonly isWorkspace: boolean,
  ) {}

  resolve(
    projectRoot: string,
    buildFolderPath: string,
    buildTomlData: UVPyprojectToml,
    workspaceRoot: string,
  ): PackageDependency[] {
    this.logger.info(chalk`  Resolving dependencies...`);
    const pyprojectPath = path.join(projectRoot, 'pyproject.toml');
    const projectData = getPyprojectData<UVPyprojectToml>(pyprojectPath);

    return this.resolveDependencies(
      projectRoot,
      projectData,
      buildFolderPath,
      buildTomlData,
      workspaceRoot,
    );
  }

  private resolveDependencies(
    projectRoot: string,
    pyproject: UVPyprojectToml,
    buildFolderPath: string,
    buildTomlData: UVPyprojectToml,
    workspaceRoot: string,
    deps: PackageDependency[] = [],
    depMap: Record<string, string> = {},
    level = 1,
  ) {
    const tab = getLoggingTab(level);

    for (const dependency of pyproject.project.dependencies) {
      if (pyproject.tool?.uv?.sources?.[dependency]) {
        const dependencyPath = this.getDependencyPath(
          workspaceRoot,
          dependency,
          projectRoot,
          pyproject.tool.uv.sources[dependency].path,
        );
        if (!dependencyPath) {
          continue;
        }

        const dependencyPyprojectPath = path.join(
          dependencyPath,
          'pyproject.toml',
        );
        if (!existsSync(dependencyPyprojectPath)) {
          this.logger.info(
            chalk`${tab}• Skipping local dependency {blue.bold ${dependency}} as pyproject.toml not found`,
          );
          continue;
        }

        const dependencyPyproject = getPyprojectData<UVPyprojectToml>(
          dependencyPyprojectPath,
        );

        const config = this.getProjectConfig(dependencyPath);
        const targetOptions: BuildExecutorSchema | undefined =
          config.targets?.build?.options;

        const publisable = targetOptions?.publish ?? true;

        if (
          this.options.bundleLocalDependencies === true ||
          publisable === false
        ) {
          this.logger.info(
            chalk`${tab}• Adding {blue.bold ${dependency}} local dependency`,
          );

          includeDependencyPackage(
            dependencyPyproject,
            dependencyPath,
            buildFolderPath,
            buildTomlData,
            workspaceRoot,
          );

          this.resolveDependencies(
            dependencyPath,
            dependencyPyproject,
            buildFolderPath,
            buildTomlData,
            workspaceRoot,
            deps,
            depMap,
            level + 1,
          );
        } else {
          deps.push({
            name: dependencyPyproject.project.name,
            version: dependencyPyproject.project.version,
            source: this.addIndex(buildTomlData, targetOptions),
          });
        }
        continue;
      }

      const match = /^[a-zA-Z0-9-]+/.exec(dependency);
      if (match) {
        if (depMap[match[0]]) {
          continue;
        }

        depMap[match[0]] = dependency;
      }

      this.logger.info(
        chalk`${tab}• Adding {blue.bold ${dependency}} dependency`,
      );
      deps.push({
        name: dependency,
      });
    }

    return deps;
  }

  private getDependencyPath(
    workspaceRoot: string,
    dependency: string,
    projectRoot: string,
    relativePath?: string,
  ) {
    if (this.isWorkspace) {
      if (!this.rootUvLock) {
        this.rootUvLock = getUvLockfile(path.join(workspaceRoot, 'uv.lock'));
      }
      return this.rootUvLock.package[dependency]?.source?.editable;
    } else if (relativePath) {
      return path.relative(
        process.cwd(),
        path.resolve(projectRoot, relativePath),
      );
    }

    return undefined;
  }

  private addIndex(
    buildTomlData: UVPyprojectToml,
    targetOptions: BuildExecutorSchema,
  ): string | undefined {
    if (!targetOptions?.customSourceUrl) return undefined;

    const [newIndexes, newIndexName] = this.resolveDuplicateIndexes(
      buildTomlData.tool.uv.index,
      {
        name: targetOptions.customSourceName,
        url: targetOptions.customSourceUrl,
      },
    );

    buildTomlData.tool.uv.index = newIndexes;

    return newIndexName;
  }

  private getProjectConfig(root: string) {
    for (const [, config] of Object.entries(
      this.context.projectsConfigurations.projects,
    )) {
      if (path.normalize(config.root) === path.normalize(root)) {
        return config;
      }
    }

    throw new Error(`Could not find project config for ${root}`);
  }

  private resolveDuplicateIndexes = (
    indexes: UVPyprojectTomlIndex[],
    { name, url }: UVPyprojectTomlIndex,
  ): [UVPyprojectTomlIndex[], string] => {
    if (!indexes) {
      return [[{ name, url }], name];
    }

    const existing = indexes.find((s) => s.name === name);

    if (existing) {
      if (existing.url === url) {
        return [indexes, name];
      }

      const hash = createHash('md5').update(url).digest('hex');
      const newName = `${name}-${hash}`;

      this.logger.info(
        chalk`  Duplicate index for {blue.bold ${name}} renamed to ${newName}`,
      );

      if (indexes.find((s) => s.name === newName)) {
        return [indexes, newName];
      }

      return [[...indexes, { name: newName, url }], newName];
    }

    return [[...indexes, { name, url }], name];
  };
}
