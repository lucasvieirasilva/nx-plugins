import { PyprojectToml } from '../../../graph/dependency-graph';
import { Logger } from '../../utils/logger';
import chalk from 'chalk';
import { Dependency } from './types';
import { join, normalize, relative, resolve } from 'path';
import { readFileSync } from 'fs-extra';
import { parse } from '@iarna/toml';
import { BuildExecutorSchema } from '../schema';
import { getLoggingTab, includeDependencyPackage } from './utils';
import { ExecutorContext } from '@nrwl/devkit';

export class ProjectDependencyResolver {
  private logger: Logger;
  private options: BuildExecutorSchema;
  private context: ExecutorContext;

  constructor(
    logger: Logger,
    options: BuildExecutorSchema,
    context: ExecutorContext
  ) {
    this.logger = logger;
    this.options = options;
    this.context = context;
  }

  resolve(
    root: string,
    buildFolderPath: string,
    buildTomlData: PyprojectToml
  ): Dependency[] {
    this.logger.info(chalk`  Resolving dependencies...`);
    const pyprojectPath = join(root, 'pyproject.toml');
    const pyproject = parse(
      readFileSync(pyprojectPath).toString('utf-8')
    ) as PyprojectToml;

    return this.resolveDependencies(
      pyproject,
      root,
      buildFolderPath,
      buildTomlData
    );
  }

  private resolveDependencies(
    pyproject: PyprojectToml,
    root: string,
    buildFolderPath: string,
    buildTomlData: PyprojectToml,
    level = 1
  ) {
    const tab = getLoggingTab(level);
    const deps: Dependency[] = [];
    for (const [name, data] of Object.entries(
      pyproject.tool.poetry.dependencies
    )) {
      if (name === 'python') {
        continue;
      }

      const dep = {} as Dependency;
      dep.name = name;

      if (typeof data === 'string') {
        dep.version = data;
      } else if (data.path) {
        dep.extras = data.extras;
        const depPath = relative(process.cwd(), resolve(root, data.path));
        const depPyprojectPath = join(depPath, 'pyproject.toml');
        const depPyproject = parse(
          readFileSync(depPyprojectPath).toString('utf-8')
        ) as PyprojectToml;

        const config = this.getProjectConfig(depPath);
        const publisable = config.targets?.build?.options?.publish ?? true;

        if (
          this.options.bundleLocalDependencies === true ||
          publisable === false
        ) {
          const packageName = depPyproject.tool.poetry.name;
          this.logger.info(
            chalk`${tab}• Adding {blue.bold ${packageName}} local dependency`
          );
          includeDependencyPackage(
            depPyproject,
            depPath,
            buildFolderPath,
            buildTomlData
          );
          this.resolveDependencies(
            depPyproject,
            depPath,
            buildFolderPath,
            buildTomlData,
            level + 1
          ).forEach((subDep) => deps.push(subDep));
          continue;
        } else {
          dep.version = depPyproject.tool.poetry.version;
        }
      } else {
        dep.version = data.version;
        dep.extras = data.extras;
        dep.git = data.git;
        dep.optional = data.optional;
        dep.rev = data.rev;
        dep.markers = data.markers;
      }

      if (deps.findIndex((d) => d.name === dep.name) === -1) {
        this.logger.info(
          chalk`${tab}• Adding {blue.bold ${dep.name}@${dep.version}} dependency`
        );
        deps.push(dep);
      }
    }
    return deps;
  }

  private getProjectConfig(root: string) {
    for (const [, config] of Object.entries(this.context.workspace.projects)) {
      if (normalize(config.root) === normalize(root)) {
        return config;
      }
    }

    throw new Error(`Could not find project config for ${root}`);
  }
}
