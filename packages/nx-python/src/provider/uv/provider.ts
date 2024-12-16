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
import path, { join } from 'path';
import chalk from 'chalk';
import { copySync, removeSync, writeFileSync } from 'fs-extra';
import {
  getPyprojectData,
  readPyprojectToml,
  writePyprojectToml,
} from '../utils';
import { UVLockfile, UVPyprojectToml } from './types';
import toml from '@iarna/toml';
import fs, { mkdirSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { v4 as uuid } from 'uuid';
import {
  LockedDependencyResolver,
  ProjectDependencyResolver,
} from './build/resolvers';

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
      name: projectData?.project?.name,
      version: projectData?.project?.version,
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
    await this.checkPrerequisites();
    if (
      options.lockedVersions === true &&
      options.bundleLocalDependencies === false
    ) {
      throw new Error(
        'Not supported operations, you cannot use lockedVersions without bundleLocalDependencies',
      );
    }

    this.logger.info(
      chalk`\n  {bold Building project {bgBlue  ${context.projectName} }...}\n`,
    );

    const { root } =
      context.projectsConfigurations.projects[context.projectName];

    const buildFolderPath = join(tmpdir(), 'nx-python', 'build', uuid());

    mkdirSync(buildFolderPath, { recursive: true });

    this.logger.info(chalk`  Copying project files to a temporary folder`);
    readdirSync(root).forEach((file) => {
      if (!options.ignorePaths.includes(file)) {
        const source = join(root, file);
        const target = join(buildFolderPath, file);
        copySync(source, target);
      }
    });

    const buildPyProjectToml = join(buildFolderPath, 'pyproject.toml');
    const buildTomlData = getPyprojectData<UVPyprojectToml>(buildPyProjectToml);

    const deps = options.lockedVersions
      ? new LockedDependencyResolver(this.logger).resolve(
          root,
          buildFolderPath,
          buildTomlData,
          options.devDependencies,
          context.root,
        )
      : new ProjectDependencyResolver(this.logger, options, context).resolve(
          root,
          buildFolderPath,
          buildTomlData,
          context.root,
        );

    buildTomlData.project.dependencies = [];
    buildTomlData['dependency-groups'] = {};

    if (buildTomlData.tool?.uv?.sources) {
      buildTomlData.tool.uv.sources = {};
    }

    for (const dep of deps) {
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

    writeFileSync(buildPyProjectToml, toml.stringify(buildTomlData));
    const distFolder = join(buildFolderPath, 'dist');

    removeSync(distFolder);

    this.logger.info(chalk`  Generating sdist and wheel artifacts`);
    const buildArgs = ['build'];
    runUv(buildArgs, { cwd: buildFolderPath });

    removeSync(options.outputPath);
    mkdirSync(options.outputPath, { recursive: true });
    this.logger.info(
      chalk`  Artifacts generated at {bold ${options.outputPath}} folder`,
    );
    copySync(distFolder, options.outputPath);

    if (!options.keepBuildFolder) {
      removeSync(buildFolderPath);
    }

    return buildFolderPath;
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

      if (!depMetadata?.editable) {
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
