import {
  ExecutorContext,
  joinPathFragments,
  ProjectConfiguration,
  runExecutor,
  Tree,
} from '@nx/devkit';
import {
  Dependency,
  DependencyProjectMetadata,
  IProvider,
  ProjectMetadata,
} from '../base';
import { AddExecutorSchema } from '../../executors/add/schema';
import { SpawnSyncOptions } from 'child_process';
import { Logger } from '../../executors/utils/logger';
import { PublishExecutorSchema } from '../../executors/publish/schema';
import { RemoveExecutorSchema } from '../../executors/remove/schema';
import { UpdateExecutorSchema } from '../../executors/update/schema';
import {
  BuildExecutorOutput,
  BuildExecutorSchema,
} from '../../executors/build/schema';
import { InstallExecutorSchema } from '../../executors/install/schema';
import { checkUvExecutable, getUvLockfile, runUv } from './utils';
import path from 'path';
import chalk from 'chalk';
import { removeSync, writeFileSync } from 'fs-extra';
import {
  getPyprojectData,
  readPyprojectToml,
  writePyprojectToml,
} from '../utils';
import { UVLockfile, UVPyprojectToml } from './types';
import toml from '@iarna/toml';
import fs from 'fs';

export class UVProvider implements IProvider {
  protected _rootLockfile: UVLockfile;

  constructor(
    protected workspaceRoot: string,
    protected logger: Logger,
    protected tree?: Tree,
  ) {}

  private get rootLockfile(): UVLockfile {
    if (!this._rootLockfile) {
      this._rootLockfile = getUvLockfile(
        joinPathFragments(this.workspaceRoot, 'uv.lock'),
        this.tree,
      );
    }

    return this._rootLockfile;
  }

  public async checkPrerequisites(): Promise<void> {
    await checkUvExecutable();
  }

  public getMetadata(projectRoot: string): ProjectMetadata {
    const pyprojectTomlPath = joinPathFragments(projectRoot, 'pyproject.toml');

    const projectData = this.tree
      ? readPyprojectToml<UVPyprojectToml>(this.tree, pyprojectTomlPath)
      : getPyprojectData<UVPyprojectToml>(pyprojectTomlPath);

    return {
      name: projectData?.project?.name as string,
      version: projectData?.project?.version as string,
    };
  }

  public getDependencyMetadata(
    projectRoot: string,
    dependencyName: string,
  ): DependencyProjectMetadata {
    const pyprojectTomlPath = joinPathFragments(projectRoot, 'pyproject.toml');
    const projectData = this.tree
      ? readPyprojectToml<UVPyprojectToml>(this.tree, pyprojectTomlPath)
      : getPyprojectData<UVPyprojectToml>(pyprojectTomlPath);

    const data = this.rootLockfile.package[projectData.project.name];
    console.log('data', data);

    const group = data?.dependencies?.find(
      (item) => item.name === dependencyName,
    )
      ? 'main'
      : Object.entries(data?.['dev-dependencies'] ?? {}).find(
          ([, value]) => !!value.find((item) => item.name === dependencyName),
        )?.[0];

    return {
      name: this.rootLockfile.package[dependencyName].name,
      version: this.rootLockfile.package[dependencyName].version,
      group,
    };
  }

  public updateVersion(projectRoot: string, newVersion: string): void {
    const pyprojectTomlPath = joinPathFragments(projectRoot, 'pyproject.toml');

    const projectData = this.tree
      ? readPyprojectToml<UVPyprojectToml>(this.tree, pyprojectTomlPath)
      : getPyprojectData<UVPyprojectToml>(pyprojectTomlPath);

    if (!projectData.project) {
      throw new Error('project section not found in pyproject.toml');
    }
    projectData.project.version = newVersion;

    this.tree
      ? writePyprojectToml(this.tree, pyprojectTomlPath, projectData)
      : writeFileSync(pyprojectTomlPath, toml.stringify(projectData));
  }

  public getDependencies(
    projectName: string,
    projects: Record<string, ProjectConfiguration>,
  ): Dependency[] {
    const projectData = projects[projectName];
    const pyprojectToml = joinPathFragments(projectData.root, 'pyproject.toml');

    const deps: Dependency[] = [];

    if (fs.existsSync(pyprojectToml)) {
      const tomlData = getPyprojectData<UVPyprojectToml>(pyprojectToml);

      deps.push(
        ...this.resolveDependencies(
          tomlData,
          tomlData?.project?.dependencies || [],
          'main',
          projects,
        ),
      );

      for (const group in tomlData['dependency-groups']) {
        deps.push(
          ...this.resolveDependencies(
            tomlData,
            tomlData['dependency-groups'][group],
            group,
            projects,
          ),
        );
      }
    }

    return deps;
  }

  public getDependents(
    projectName: string,
    projects: Record<string, ProjectConfiguration>,
    cwd: string,
  ): string[] {
    const result: string[] = [];

    const { root } = projects[projectName];

    Object.values(this.rootLockfile.package).forEach((pkg) => {
      const deps = [
        ...Object.values(pkg.metadata['requires-dist'] ?? {}),
        ...Object.values(pkg.metadata['requires-dev'] ?? {})
          .map((dev) => Object.values(dev))
          .flat(),
      ];

      for (const dep of deps) {
        if (
          dep.editable &&
          path.normalize(dep.editable) === path.normalize(root)
        ) {
          result.push(pkg.name);
        }
      }
    });

    return result;
  }

  public async add(
    options: AddExecutorSchema,
    context: ExecutorContext,
  ): Promise<void> {
    await this.checkPrerequisites();

    const projectRoot =
      context.projectsConfigurations.projects[context.projectName].root;

    const args = ['add', options.name, '--project', projectRoot];
    if (options.group) {
      args.push('--group', options.group);
    }

    for (const extra of options.extras ?? []) {
      args.push('--extra', extra);
    }

    args.push(...(options.args ?? '').split(' ').filter((arg) => !!arg));

    runUv(args, {
      cwd: context.root,
    });
  }

  public async update(
    options: UpdateExecutorSchema,
    context: ExecutorContext,
  ): Promise<void> {
    await this.checkPrerequisites();

    const projectRoot =
      context.projectsConfigurations.projects[context.projectName].root;

    const args = [
      'lock',
      '--upgrade-package',
      options.name,
      '--project',
      projectRoot,
    ];
    runUv(args, {
      cwd: context.root,
    });
    runUv(['sync'], {
      cwd: context.root,
    });
  }

  public async remove(
    options: RemoveExecutorSchema,
    context: ExecutorContext,
  ): Promise<void> {
    await this.checkPrerequisites();

    const projectRoot =
      context.projectsConfigurations.projects[context.projectName].root;

    const args = ['remove', options.name, '--project', projectRoot];
    args.push(...(options.args ?? '').split(' ').filter((arg) => !!arg));
    runUv(args, {
      cwd: context.root,
    });
  }

  public async publish(
    options: PublishExecutorSchema,
    context: ExecutorContext,
  ): Promise<void> {
    let buildFolderPath = '';

    try {
      await this.checkPrerequisites();

      for await (const output of await runExecutor<BuildExecutorOutput>(
        {
          project: context.projectName,
          target: options.buildTarget,
          configuration: context.configurationName,
        },
        {
          keepBuildFolder: true,
        },
        context,
      )) {
        if (!output.success) {
          throw new Error('Build failed');
        }

        buildFolderPath = output.buildFolderPath;
      }

      if (!buildFolderPath) {
        throw new Error('Cannot find the temporary build folder');
      }

      this.logger.info(
        chalk`\n  {bold Publishing project {bgBlue  ${context.projectName} }...}\n`,
      );

      if (options.dryRun) {
        this.logger.info(
          chalk`\n  {bgYellow.bold  WARNING } {bold Dry run is currently not supported by uv}\n`,
        );
      }

      const args = ['publish', ...(options.__unparsed__ ?? [])];
      runUv(args, {
        cwd: buildFolderPath,
      });

      removeSync(buildFolderPath);
    } catch (error) {
      if (buildFolderPath) {
        removeSync(buildFolderPath);
      }

      throw error;
    }
  }

  public async install(
    options: InstallExecutorSchema,
    context: ExecutorContext,
  ): Promise<void> {
    await this.checkPrerequisites();

    const args = ['sync'];
    if (options.verbose) {
      args.push('-v');
    } else if (options.debug) {
      args.push('-vvv');
    }

    args.push(...(options.args ?? '').split(' ').filter((arg) => !!arg));

    if (options.cacheDir) {
      args.push('--cache-dir', options.cacheDir);
    }

    runUv(args, {
      cwd: context.root,
    });
  }

  public async lock(projectRoot: string): Promise<void> {
    runUv(['lock'], { cwd: projectRoot });
  }

  public async build(
    options: BuildExecutorSchema,
    context: ExecutorContext,
  ): Promise<string> {
    throw new Error('Method not implemented.');
  }

  public async run(
    args: string[],
    workspaceRoot: string,
    options: {
      log?: boolean;
      error?: boolean;
    } & SpawnSyncOptions,
  ): Promise<void> {
    await this.checkPrerequisites();

    runUv(['run', ...args], {
      ...options,
    });
  }

  public activateVenv(workspaceRoot: string): void {
    if (!process.env.VIRTUAL_ENV) {
      const virtualEnv = path.resolve(workspaceRoot, '.venv');
      process.env.VIRTUAL_ENV = virtualEnv;
      process.env.PATH = `${virtualEnv}/bin:${process.env.PATH}`;
      delete process.env.PYTHONHOME;
    }
  }

  private resolveDependencies(
    pyprojectToml: UVPyprojectToml | undefined,
    dependencies: string[],
    category: string,
    projects: Record<string, ProjectConfiguration>,
  ) {
    if (!pyprojectToml) {
      return [];
    }

    const deps: Dependency[] = [];
    const sources = pyprojectToml?.tool?.uv?.sources ?? {};

    for (const dep of dependencies) {
      if (!sources[dep]?.workspace) {
        continue;
      }

      const packageMetadata =
        this.rootLockfile.package[pyprojectToml?.project?.name]?.metadata;

      const depMetadata =
        category === 'main'
          ? packageMetadata?.['requires-dist']?.[dep]
          : packageMetadata?.['requires-dev']?.[category]?.[dep];

      if (!depMetadata || !depMetadata.editable) {
        continue;
      }

      const depProjectName = Object.keys(projects).find(
        (proj) =>
          path.normalize(projects[proj].root) ===
          path.normalize(depMetadata.editable),
      );

      if (!depProjectName) {
        continue;
      }

      deps.push({ name: depProjectName, category });
    }

    return deps;
  }
}
