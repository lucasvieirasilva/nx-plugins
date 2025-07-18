import chalk from 'chalk';
import { join, normalize, relative, resolve } from 'path';
import { readFileSync } from 'fs-extra';
import { parse } from '@iarna/toml';
import { includeDependencyPackage } from './utils';
import { ExecutorContext } from '@nx/devkit';
import { createHash } from 'crypto';
import { PoetryPyprojectToml, PoetryPyprojectTomlSource } from '../../types';
import { BuildExecutorSchema } from '../../../../executors/build/schema';
import { Logger } from '../../../../executors/utils/logger';
import { getLoggingTab } from '../../../utils';
import { BaseDependencyResolver } from './base';

export class ProjectDependencyResolver extends BaseDependencyResolver {
  constructor(
    logger: Logger,
    options: BuildExecutorSchema,
    context: ExecutorContext,
  ) {
    super(logger, options, context);
  }

  apply(
    root: string,
    buildFolderPath: string,
    buildTomlData: PoetryPyprojectToml,
  ): PoetryPyprojectToml {
    this.logger.info(chalk`  Resolving dependencies...`);

    return this.updatePyproject(root, buildTomlData, buildFolderPath);
  }

  private updatePyproject(
    root: string,
    pyproject: PoetryPyprojectToml,
    buildFolderPath: string,
    loggedDependencies: string[] = [],
  ): PoetryPyprojectToml {
    const tab = getLoggingTab(1);

    const targetDependencies = this.getMainDependencyObject(pyproject);

    let hasMoreLevels = false;

    for (const name in targetDependencies) {
      if (name === 'python') {
        continue;
      }

      const data = targetDependencies[name];

      if (typeof data === 'string') {
        if (!loggedDependencies) {
          this.logger.info(
            chalk`${tab}• Adding {blue.bold ${name}@${data}} dependency`,
          );
          loggedDependencies.push(name);
        }
      } else if (data.path) {
        const depPath = relative(process.cwd(), resolve(root, data.path));
        const depPyprojectPath = join(depPath, 'pyproject.toml');
        const depPyproject = parse(
          readFileSync(depPyprojectPath).toString('utf-8'),
        ) as PoetryPyprojectToml;

        const config = this.getProjectConfig(depPath);
        const targetOptions: BuildExecutorSchema | undefined =
          config.targets?.build?.options;
        const publisable = targetOptions?.publish ?? true;

        if (
          this.options.bundleLocalDependencies === true ||
          publisable === false
        ) {
          const packageName = depPyproject.tool.poetry.name;
          if (!loggedDependencies.includes(packageName)) {
            this.logger.info(
              chalk`${tab}• Adding {blue.bold ${packageName}} local dependency`,
            );
            loggedDependencies.push(packageName);
          }

          includeDependencyPackage(
            depPyproject,
            depPath,
            buildFolderPath,
            pyproject,
          );

          const depDependencies =
            this.getPyProjectMainDependencies(depPyproject);

          // Remove the local dependency from the target pyproject
          delete targetDependencies[packageName];

          const depExtras = depPyproject.tool?.poetry?.extras ?? {};
          const targetExtras = pyproject.tool?.poetry?.extras ?? {};

          // Merge the extras from the local sub dependency to the target pyproject
          if (depPyproject?.tool?.poetry?.extras) {
            for (const [extraName, extraData] of Object.entries(depExtras)) {
              if (targetExtras[extraName]) {
                targetExtras[extraName] = [
                  ...new Set([...targetExtras[extraName], ...extraData]),
                ];
              } else {
                targetExtras[extraName] = extraData;
              }
            }

            pyproject.tool.poetry.extras = targetExtras;
          }

          for (const [depName, depData] of depDependencies) {
            if (depName === 'python') {
              continue;
            }

            if (typeof depData === 'object' && depData.path) {
              hasMoreLevels = true;
              targetDependencies[depName] = {
                ...depData,
                extras:
                  // If the target dependency has extras, merge them with the sub dependency extras
                  typeof targetDependencies[depName] === 'object' &&
                  targetDependencies[depName]?.extras
                    ? [
                        ...new Set([
                          ...(targetDependencies[depName]?.extras ?? []),
                          ...(depData.extras ?? []),
                        ]),
                      ]
                    : depData.extras,
                path: relative(
                  join(process.cwd(), root),
                  resolve(depPath, depData.path),
                ),
              };
            } else {
              targetDependencies[depName] = depData;

              if (!loggedDependencies.includes(depName)) {
                this.logger.info(
                  chalk`${tab}• Adding {blue.bold ${depName}@${typeof depData === 'string' ? depData : depData.version}} dependency`,
                );
                loggedDependencies.push(depName);
              }
            }

            if (data.extras && !data.optional) {
              for (const extraName of data.extras) {
                const libsToSetToMain = depExtras[extraName] ?? [];
                for (const lib of libsToSetToMain) {
                  /**
                   * Change optional to false when the dependency is optional
                   * on the local sub dependency, but it is required by the
                   * target dependency via an extra.
                   *
                   * Example:
                   *
                   * Target pyproject.toml:
                   *
                   * [[tool.poetry.packages]]
                   * include = "app"
                   *
                   * [tool.poetry.dependencies]
                   * python = ">=3.10,<3.11"
                   * lib = { path = "libs/lib", extras = ["color"] }
                   *
                   * Sub dependency pyproject.toml:
                   *
                   * [[tool.poetry.packages]]
                   * include = "lib"
                   *
                   * [tool.poetry.dependencies]
                   * python = ">=3.10,<3.11"
                   * colored = { version = "^2.3.0", optional = true }
                   * python-json-logger = { version = "^2.0.4", optional = true }
                   *
                   * [tool.poetry.extras]
                   * color = ["colored"]
                   * json = ["python-json-logger"]
                   *
                   * This will result in the following pyproject.toml:
                   *
                   * [[tool.poetry.packages]]
                   * include = "app"
                   *
                   * [[tool.poetry.packages]]
                   * include = "lib"
                   *
                   * [tool.poetry.dependencies]
                   * python = ">=3.10,<3.11"
                   * colored = "^2.3.0"
                   * python-json-logger = { version = "^2.0.4", optional = true }
                   *
                   * [tool.poetry.extras]
                   * json = ["python-json-logger"]
                   */
                  if (
                    targetDependencies[lib] &&
                    typeof targetDependencies[lib] === 'object' &&
                    targetDependencies[lib].optional
                  ) {
                    const dep = targetDependencies[lib];
                    targetDependencies[lib] =
                      dep.markers || dep.extras || dep.git || dep.source
                        ? {
                            ...dep,
                            optional: undefined,
                          }
                        : dep.version;
                  }
                }
              }
            }
          }
        } else {
          const source = this.addSource(pyproject, targetOptions);
          if (source) {
            targetDependencies[name] = {
              version: depPyproject.tool.poetry.version,
              source: source,
            };
          } else {
            targetDependencies[name] = depPyproject.tool.poetry.version;
          }

          if (!loggedDependencies.includes(name)) {
            this.logger.info(
              chalk`${tab}• Adding {blue.bold ${name}@${depPyproject.tool.poetry.version}} local dependency`,
            );
            loggedDependencies.push(name);
          }
        }
      } else {
        if (!loggedDependencies.includes(name)) {
          this.logger.info(
            chalk`${tab}• Adding {blue.bold ${name}${data.version ? `@${data.version}` : data.git ? ` ${data.git}@${data.rev}` : ''}} dependency`,
          );
          loggedDependencies.push(name);
        }
      }
    }

    // Remove extras that are not optional anymore
    for (const [extraName, extraData] of Object.entries(
      pyproject.tool?.poetry?.extras ?? {},
    )) {
      pyproject.tool.poetry.extras[extraName] = extraData.filter(
        (d) =>
          targetDependencies[d] &&
          typeof targetDependencies[d] === 'object' &&
          targetDependencies[d].optional,
      );

      if (!pyproject.tool.poetry.extras[extraName]?.length) {
        delete pyproject.tool.poetry.extras[extraName];
      }
    }

    // If there are more local dependencies to resolve, call this function again
    // until there are no more local dependencies to resolve.
    if (hasMoreLevels) {
      this.updatePyproject(
        root,
        pyproject,
        buildFolderPath,
        loggedDependencies,
      );
    }

    return pyproject;
  }

  private addSource(
    buildTomlData: PoetryPyprojectToml,
    targetOptions: BuildExecutorSchema,
  ): string | undefined {
    if (!targetOptions?.customSourceUrl) return undefined;

    const [newSources, newSourceName] = this.resolveDuplicateSources(
      buildTomlData.tool.poetry.source,
      {
        name: targetOptions.customSourceName,
        url: targetOptions.customSourceUrl,
      },
    );

    buildTomlData.tool.poetry.source = newSources;

    return newSourceName;
  }

  private getProjectConfig(root: string) {
    for (const [, config] of Object.entries(
      this.context.projectsConfigurations.projects,
    )) {
      if (normalize(config.root) === normalize(root)) {
        return config;
      }
    }

    throw new Error(`Could not find project config for ${root}`);
  }

  private resolveDuplicateSources = (
    sources: PoetryPyprojectTomlSource[],
    { name, url }: PoetryPyprojectTomlSource,
  ): [PoetryPyprojectTomlSource[], string] => {
    if (!sources) {
      return [[{ name, url }], name];
    }

    const existing = sources.find((s) => s.name === name);

    if (existing) {
      if (existing.url === url) {
        return [sources, name];
      }

      const hash = createHash('md5').update(url).digest('hex');
      const newName = `${name}-${hash}`;

      this.logger.info(
        chalk`  Duplicate source for {blue.bold ${name}} renamed to ${newName}`,
      );

      if (sources.find((s) => s.name === newName)) {
        return [sources, newName];
      }

      return [[...sources, { name: newName, url }], newName];
    }

    return [[...sources, { name, url }], name];
  };
}
