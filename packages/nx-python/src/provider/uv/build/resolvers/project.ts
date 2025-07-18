import chalk from 'chalk';
import path, { join, relative, resolve } from 'path';
import { existsSync } from 'fs-extra';
import { UVLockfile, UVPyprojectToml, UVPyprojectTomlIndex } from '../../types';
import { Logger } from '../../../../executors/utils/logger';
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

  apply(
    projectRoot: string,
    buildFolderPath: string,
    buildTomlData: UVPyprojectToml,
    workspaceRoot: string,
  ): UVPyprojectToml {
    this.logger.info(chalk`  Resolving dependencies...`);

    return this.updatePyproject(
      projectRoot,
      buildFolderPath,
      buildTomlData,
      workspaceRoot,
    );
  }

  private updatePyproject(
    projectRoot: string,
    buildFolderPath: string,
    pyproject: UVPyprojectToml,
    workspaceRoot: string,
    loggedDependencies: string[] = [],
  ): UVPyprojectToml {
    const tab = getLoggingTab(1);
    let hasMoreLevels = false;

    const dependencies = this.getProjectDependencies(pyproject);

    for (const [group, dependencyName] of dependencies) {
      const normalizedName = this.normalizeDependencyName(dependencyName);
      const dependency =
        group === '__main__'
          ? pyproject.project.dependencies.find(
              (d) => this.normalizeDependencyName(d) === normalizedName,
            )
          : pyproject.project['optional-dependencies']?.[group]?.find(
              (d) => this.normalizeDependencyName(d) === normalizedName,
            );
      const extras = this.extractExtraFromDependencyName(dependency);

      if (!normalizedName) {
        continue;
      }

      if (pyproject.tool?.uv?.sources?.[normalizedName]) {
        const dependencyPath = this.getDependencyPath(
          workspaceRoot,
          normalizedName,
          projectRoot,
          pyproject.tool.uv.sources[normalizedName].path,
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
          if (!loggedDependencies.includes(dependency)) {
            this.logger.info(
              chalk`${tab}• Adding {blue.bold ${dependency}} local dependency`,
            );
            loggedDependencies.push(dependency);
          }

          includeDependencyPackage(
            dependencyPyproject,
            dependencyPath,
            buildFolderPath,
            pyproject,
            workspaceRoot,
          );

          const depDependencies =
            this.getProjectDependencies(dependencyPyproject);

          // Remove the local dependency from the target pyproject
          this.removeDependency(group, dependency, pyproject);
          delete pyproject.tool.uv.sources[normalizedName];

          const dependencyPyProjectExtras =
            dependencyPyproject.project?.['optional-dependencies'] ?? {};
          const targetExtras =
            pyproject.project?.['optional-dependencies'] ?? {};

          // Merge the extras from the local sub dependency to the target pyproject
          if (dependencyPyproject.project?.['optional-dependencies']) {
            for (const [extraName, extraData] of Object.entries(
              dependencyPyProjectExtras,
            )) {
              if (targetExtras[extraName]) {
                for (const dep of extraData) {
                  const normalizedDep = this.normalizeDependencyName(dep);
                  if (
                    normalizedDep &&
                    !targetExtras[extraName].some(
                      (d) => this.normalizeDependencyName(d) === normalizedDep,
                    )
                  ) {
                    targetExtras[extraName].push(dep);
                  }
                }
              } else {
                targetExtras[extraName] = extraData;
              }
            }

            pyproject.project['optional-dependencies'] = targetExtras;
          }

          for (const [depGroup, depName] of depDependencies) {
            let depGroupToUse = depGroup;
            const normalizedDep = this.normalizeDependencyName(depName);
            const depExtras = this.extractExtraFromDependencyName(depName);

            if (extras.length && group === '__main__') {
              for (const extraName of extras) {
                const libsToSetToMain =
                  dependencyPyProjectExtras[extraName] ?? [];

                /**
                 * Move the dependency from the optional block to the main
                 * dependencies block when the dependency is optional on the
                 * local sub dependency, but it is required by the target
                 * dependency via an extra.
                 *
                 * Example:
                 *
                 * Target pyproject.toml:
                 *
                 * [project]
                 * include = "app"
                 * dependencies = [
                 *  "lib[color]"
                 * ]
                 *
                 * [tool.uv.sources]
                 * lib = { path = "libs/lib" }
                 *
                 * Sub dependency pyproject.toml:
                 *
                 * [project.optional-dependencies]
                 * color = [
                 *  "colored>=2.3.0"
                 * ]
                 * json = [
                 *  "python-json-logger>=2.0.4"
                 * ]
                 *
                 *
                 * This will result in the following pyproject.toml:
                 *
                 * [project]
                 * dependencies = [
                 *  "colored>=2.3.0"
                 * ]
                 *
                 * [project.optional-dependencies]
                 * json = [
                 *  "python-json-logger>=2.0.4"
                 * ]
                 */
                if (
                  libsToSetToMain.some(
                    (lib) =>
                      this.normalizeDependencyName(lib) === normalizedDep,
                  )
                ) {
                  depGroupToUse = '__main__';

                  /**
                   * Remove the dependency from the optional dependencies group
                   * when changing the dependency from optional to main.
                   */
                  if (
                    pyproject.project?.['optional-dependencies']?.[extraName]
                  ) {
                    pyproject.project['optional-dependencies'][extraName] =
                      pyproject.project['optional-dependencies'][
                        extraName
                      ].filter(
                        (d) =>
                          this.normalizeDependencyName(d) !== normalizedDep,
                      );

                    // If the optional dependencies group is empty, remove it
                    if (
                      pyproject.project['optional-dependencies'][extraName]
                        .length === 0
                    ) {
                      delete pyproject.project['optional-dependencies'][
                        extraName
                      ];
                    }
                  }
                }
              }
            }

            if (
              dependencyPyproject.tool?.uv?.sources?.[normalizedDep]?.path ||
              dependencyPyproject.tool?.uv?.sources?.[normalizedDep]?.workspace
            ) {
              hasMoreLevels = true;

              const existingDepExtras = this.extractExtraFromDependencyName(
                depGroupToUse === '__main__'
                  ? pyproject.project.dependencies.find(
                      (d) => this.normalizeDependencyName(d) === normalizedDep,
                    )
                  : pyproject.project?.['optional-dependencies']?.[
                      depGroupToUse
                    ]?.find(
                      (d) => this.normalizeDependencyName(d) === normalizedDep,
                    ),
              );

              const newExtras = [
                ...(existingDepExtras ?? []),
                ...(depExtras ?? []),
              ];

              this.appendDependency(
                pyproject,
                targetOptions,
                depGroupToUse,
                newExtras.length
                  ? `${normalizedDep}[${newExtras.join(',')}]`
                  : depName,
                true,
              );

              pyproject.tool.uv.sources ??= {};
              pyproject.tool.uv.sources[normalizedDep] = {
                ...dependencyPyproject.tool.uv.sources[normalizedDep],
              };

              if (pyproject.tool.uv.sources[normalizedDep].path) {
                pyproject.tool.uv.sources[normalizedDep].path = relative(
                  join(process.cwd(), projectRoot),
                  resolve(
                    dependencyPath,
                    pyproject.tool.uv.sources[normalizedDep].path,
                  ),
                );
              }
            } else {
              this.appendDependency(
                pyproject,
                targetOptions,
                depGroupToUse,
                depName,
              );

              if (!loggedDependencies.includes(depName)) {
                this.logger.info(
                  chalk`${tab}• Adding {blue.bold ${depName}} dependency`,
                );
                loggedDependencies.push(depName);
              }
            }
          }
        } else {
          const index = this.addIndex(pyproject, targetOptions);
          const depName = `${dependency}==${dependencyPyproject.project.version}`;
          this.appendDependency(pyproject, targetOptions, group, depName, true);

          if (pyproject.tool?.uv?.sources?.[normalizedName] && !index) {
            delete pyproject.tool.uv.sources[normalizedName];
          } else {
            pyproject.tool ??= { uv: {} };
            pyproject.tool.uv ??= { sources: {} };
            pyproject.tool.uv.sources ??= {};
            pyproject.tool.uv.sources[normalizedName] = {
              index,
            };
          }

          if (!loggedDependencies.includes(depName)) {
            this.logger.info(
              chalk`${tab}• Adding {blue.bold ${depName}} local dependency`,
            );
            loggedDependencies.push(depName);
          }
        }
      } else {
        if (!loggedDependencies.includes(dependency)) {
          this.logger.info(
            chalk`${tab}• Adding {blue.bold ${dependency}} dependency`,
          );
          loggedDependencies.push(dependency);
        }
      }
    }

    // Remove extras that are not optional anymore
    for (const [extraName, extraData] of Object.entries(
      pyproject.project['optional-dependencies'] ?? {},
    )) {
      pyproject.project['optional-dependencies'][extraName] = extraData.filter(
        (optionalDep) =>
          !pyproject.project.dependencies
            .map((dep) => this.normalizeDependencyName(dep))
            .includes(this.normalizeDependencyName(optionalDep)),
      );

      if (!pyproject.project['optional-dependencies'][extraName]?.length) {
        delete pyproject.project['optional-dependencies'][extraName];
      }
    }

    if (hasMoreLevels) {
      this.updatePyproject(
        projectRoot,
        buildFolderPath,
        pyproject,
        workspaceRoot,
        loggedDependencies,
      );
    }

    return pyproject;
  }

  private extractExtraFromDependencyName(
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

  private removeDependency(
    group: string,
    dependency: string,
    pyproject: UVPyprojectToml,
  ) {
    if (group === '__main__') {
      pyproject.project.dependencies = pyproject.project.dependencies.filter(
        (dep) => dep !== dependency,
      );
    } else {
      pyproject.project['optional-dependencies'] ??= {};
      pyproject.project['optional-dependencies'][group] = pyproject.project[
        'optional-dependencies'
      ]?.[group]?.filter((dep) => dep !== dependency);
    }
  }

  private appendDependency(
    pyproject: UVPyprojectToml,
    targetOptions: BuildExecutorSchema,
    group: string,
    dependency: string,
    force = false,
  ) {
    const index = this.addIndex(pyproject, targetOptions);
    const normalizedName = this.normalizeDependencyName(dependency);
    if (group === '__main__') {
      const existingIndex = pyproject.project.dependencies.findIndex(
        (dep) => this.normalizeDependencyName(dep) === normalizedName,
      );

      if (existingIndex !== -1 && !force) {
        return;
      }

      if (existingIndex !== -1) {
        pyproject.project.dependencies[existingIndex] = dependency;
      } else {
        pyproject.project.dependencies.push(dependency);
      }
    } else {
      pyproject.project['optional-dependencies'] ??= {};
      pyproject.project['optional-dependencies'][group] ??= [];

      const existingIndex = pyproject.project['optional-dependencies'][
        group
      ].findIndex(
        (dep) => this.normalizeDependencyName(dep) === normalizedName,
      );

      if (existingIndex !== -1 && !force) {
        return;
      }

      if (existingIndex !== -1) {
        pyproject.project['optional-dependencies'][group][existingIndex] =
          dependency;
      } else {
        pyproject.project['optional-dependencies'][group].push(dependency);
      }
    }

    if (index) {
      pyproject.tool ??= { uv: {} };
      pyproject.tool.uv ??= { sources: {} };
      pyproject.tool.uv.sources ??= {};
      pyproject.tool.uv.sources[normalizedName] = {
        index,
      };
    }
  }

  private getProjectDependencies(pyproject: UVPyprojectToml): string[][] {
    return [
      ...pyproject.project.dependencies.map((dep) => ['__main__', dep]),
      ...Object.entries(
        pyproject.project['optional-dependencies'] ?? {},
      ).reduce((acc, [extra, deps]) => {
        for (const dep of deps) {
          acc.push([extra, dep]);
        }
        return acc;
      }, [] as string[][]),
    ];
  }

  private normalizeDependencyName(dependency: string): string | undefined {
    const match = /^[a-zA-Z0-9-_]+/.exec(dependency);
    if (!match) {
      return undefined;
    }

    return match[0];
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
