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
import {
  checkUvExecutable,
  getUvLockfile,
  runUv,
  RunUvOptions,
  UV_EXECUTABLE,
} from './utils';
import path, { join } from 'path';
import chalk from 'chalk';
import { copySync, removeSync, writeFileSync } from 'fs-extra';
import {
  getLocalDependencyConfig,
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
import { LockExecutorSchema } from '../../executors/lock/schema';
import { SyncExecutorSchema } from '../../executors/sync/schema';

export class UVProvider implements IProvider {
  protected _rootLockfile: UVLockfile;
  protected isWorkspace = false;

  constructor(
    protected readonly workspaceRoot: string,
    protected readonly logger: Logger,
    protected readonly tree?: Tree,
  ) {
    const uvLockPath = joinPathFragments(workspaceRoot, 'uv.lock');
    this.isWorkspace = tree
      ? tree.exists(uvLockPath)
      : fs.existsSync(uvLockPath);
  }

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

    if (this.isWorkspace) {
      const data = this.rootLockfile.package[projectData.project.name];
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
    } else {
      const dependencyRelativePath =
        projectData.tool?.uv?.sources?.[dependencyName]?.path;
      if (!dependencyRelativePath) {
        throw new Error(
          `Dependency ${dependencyName} not found in pyproject.toml`,
        );
      }

      const dependencyPyprojectPath = join(
        projectRoot,
        dependencyRelativePath,
        'pyproject.toml',
      );

      const dependencyProjectData = this.tree
        ? readPyprojectToml<UVPyprojectToml>(this.tree, dependencyPyprojectPath)
        : getPyprojectData<UVPyprojectToml>(dependencyPyprojectPath);

      if (!dependencyProjectData) {
        throw new Error(`${dependencyPyprojectPath} not found`);
      }

      const group = projectData.project?.dependencies?.find(
        (item) => item === dependencyName,
      )
        ? 'main'
        : Object.entries(projectData['dependency-groups'] ?? {}).find(
            ([, value]) => !!value.find((item) => item === dependencyName),
          )?.[0];

      return {
        name: dependencyProjectData.project.name,
        version: dependencyProjectData.project.version,
        group,
      };
    }
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
      const sources = this.sources(tomlData);

      deps.push(
        ...this.resolveDependencies(
          projectName,
          sources,
          projects[projectName],
          tomlData?.project?.dependencies || [],
          'main',
          projects,
        ),
      );

      for (const group in tomlData['dependency-groups']) {
        deps.push(
          ...this.resolveDependencies(
            projectName,
            sources,
            projects[projectName],
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
    if (this.isWorkspace) {
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
    } else {
      const pyprojectToml = getPyprojectData<UVPyprojectToml>(
        joinPathFragments(root, 'pyproject.toml'),
      );

      for (const project in projects) {
        const projectData = projects[project];
        const projectPyprojectTomlPath = joinPathFragments(
          projectData.root,
          'pyproject.toml',
        );
        if (fs.existsSync(projectPyprojectTomlPath)) {
          const tomlData = getPyprojectData<UVPyprojectToml>(
            projectPyprojectTomlPath,
          );

          if (tomlData.tool?.uv?.sources?.[pyprojectToml.project.name]) {
            result.push(project);
          }
        }
      }
    }

    return result;
  }

  public async add(
    options: AddExecutorSchema,
    context: ExecutorContext,
  ): Promise<void> {
    await this.checkPrerequisites();
    const projectConfig =
      context.projectsConfigurations.projects[context.projectName];
    const projectRoot = projectConfig.root;

    const args = ['add'];
    if (!this.isWorkspace && options.local) {
      const dependencyConfig = getLocalDependencyConfig(context, options.name);
      const dependencyPath = path.relative(
        projectConfig.root,
        dependencyConfig.root,
      );

      args.push('--editable', dependencyPath);
    } else {
      args.push(options.name);
    }

    if (options.group) {
      args.push('--group', options.group);
    }

    for (const extra of options.extras ?? []) {
      args.push('--extra', extra);
    }

    args.push(...(options.args ?? '').split(' ').filter((arg) => !!arg));

    if (this.isWorkspace) {
      args.push('--project', projectRoot);
      runUv(args, {
        cwd: context.root,
      });
    } else {
      runUv(args, {
        cwd: projectRoot,
      });
    }

    if (!this.isWorkspace) {
      this.syncDependents(context, context.projectName);
    }
  }

  public async update(
    options: UpdateExecutorSchema,
    context: ExecutorContext,
  ): Promise<void> {
    await this.checkPrerequisites();
    const projectRoot = this.getProjectRoot(context);

    const args = ['lock', '--upgrade-package', options.name];
    if (this.isWorkspace) {
      args.push('--project', projectRoot);
    }

    runUv(args, {
      cwd: this.isWorkspace ? context.root : projectRoot,
    });
    runUv(['sync'], {
      cwd: this.isWorkspace ? context.root : projectRoot,
    });

    if (!this.isWorkspace) {
      this.syncDependents(context, context.projectName);
    }
  }

  public async remove(
    options: RemoveExecutorSchema,
    context: ExecutorContext,
  ): Promise<void> {
    await this.checkPrerequisites();

    const projectRoot = this.getProjectRoot(context);

    const args = ['remove', options.name];
    if (this.isWorkspace) {
      args.push('--project', projectRoot);
    }

    args.push(...(options.args ?? '').split(' ').filter((arg) => !!arg));
    runUv(args, {
      cwd: this.isWorkspace ? context.root : projectRoot,
    });

    if (!this.isWorkspace) {
      this.syncDependents(context, context.projectName);
    }
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
    options?: InstallExecutorSchema,
    context?: ExecutorContext,
  ): Promise<void>;

  public async install(cwd?: string): Promise<void>;

  public async install(
    optionsOrCwd?: InstallExecutorSchema | string,
    context?: ExecutorContext,
  ): Promise<void> {
    await this.checkPrerequisites();

    const args = ['sync'];
    const execOptions: RunUvOptions = {
      cwd: context
        ? this.isWorkspace
          ? context.root
          : this.getProjectRoot(context)
        : undefined,
    };
    if (optionsOrCwd && typeof optionsOrCwd === 'object') {
      const options = optionsOrCwd;

      if (options.verbose) {
        args.push('-v');
      } else if (options.debug) {
        args.push('-vvv');
      }

      args.push(...(options.args ?? '').split(' ').filter((arg) => !!arg));
      if (options.cacheDir) {
        args.push('--cache-dir', options.cacheDir);
      }
    } else if (optionsOrCwd && typeof optionsOrCwd === 'string') {
      execOptions.cwd = optionsOrCwd;
    }

    runUv(args, execOptions);
  }

  public async getLockCommand(
    _projectRoot?: string,
    update?: boolean,
  ): Promise<string> {
    return `${UV_EXECUTABLE} lock${update ? ' --upgrade' : ''}`;
  }

  public async lock(
    options?: LockExecutorSchema,
    context?: ExecutorContext,
  ): Promise<void>;

  public async lock(projectRoot?: string, update?: boolean): Promise<void>;

  public async lock(
    optionsOrprojectRoot?: LockExecutorSchema | string,
    contextOrUpdate?: ExecutorContext | boolean,
  ): Promise<void> {
    await this.checkPrerequisites();

    if (
      typeof optionsOrprojectRoot === 'object' &&
      contextOrUpdate &&
      typeof contextOrUpdate === 'object'
    ) {
      const options = optionsOrprojectRoot;
      const projectConfig =
        contextOrUpdate.projectsConfigurations?.projects?.[
          contextOrUpdate.projectName
        ];

      if (!projectConfig) {
        throw new Error(
          `Project ${contextOrUpdate.projectName} not found in the workspace`,
        );
      }

      const cwd = this.isWorkspace ? contextOrUpdate.root : projectConfig.root;

      const lockCommand = await this.getLockCommand(cwd, options.update);

      const args = lockCommand.split(' ').slice(1);
      if (options.args) {
        args.push(...options.args.split(' '));
      }

      if (options.verbose) {
        args.push('-v');
      } else if (options.debug) {
        args.push('-vvv');
      }

      if (options.cacheDir) {
        args.push('--cache-dir', options.cacheDir);
      }

      const execOptions: RunUvOptions = { cwd };
      if (options.silent) {
        execOptions.log = false;
      }

      runUv(args, execOptions);
    } else if (
      typeof optionsOrprojectRoot === 'string' &&
      (contextOrUpdate === undefined || typeof contextOrUpdate === 'boolean')
    ) {
      const updateOption =
        contextOrUpdate === undefined ? false : (contextOrUpdate as boolean);

      const lockCommand = await this.getLockCommand(
        optionsOrprojectRoot,
        updateOption,
      );

      runUv(
        lockCommand.split(' ').slice(1),
        optionsOrprojectRoot ? { cwd: optionsOrprojectRoot } : undefined,
      );
    } else {
      const updateOption =
        contextOrUpdate === undefined ? false : (contextOrUpdate as boolean);

      const lockCommand = await this.getLockCommand(undefined, updateOption);
      runUv(lockCommand.split(' ').slice(1));
    }
  }

  public async sync(
    options?: SyncExecutorSchema,
    context?: ExecutorContext,
  ): Promise<void> {
    return await this.install(options, context);
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

    const projectRoot = this.getProjectRoot(context);

    const buildFolderPath = join(tmpdir(), 'nx-python', 'build', uuid());

    mkdirSync(buildFolderPath, { recursive: true });

    this.logger.info(chalk`  Copying project files to a temporary folder`);
    readdirSync(projectRoot).forEach((file) => {
      if (!options.ignorePaths.includes(file)) {
        const source = join(projectRoot, file);
        const target = join(buildFolderPath, file);
        copySync(source, target);
      }
    });

    const buildPyProjectToml = join(buildFolderPath, 'pyproject.toml');
    const buildTomlData = getPyprojectData<UVPyprojectToml>(buildPyProjectToml);

    const deps = options.lockedVersions
      ? new LockedDependencyResolver(this.logger, this.isWorkspace).resolve(
          projectRoot,
          buildFolderPath,
          buildTomlData,
          options.devDependencies,
          context.root,
        )
      : new ProjectDependencyResolver(
          this.logger,
          options,
          context,
          this.isWorkspace,
        ).resolve(projectRoot, buildFolderPath, buildTomlData, context.root);

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

  public async getRunCommand(args: string[]): Promise<string> {
    return `${UV_EXECUTABLE} run ${args.join(' ')}`;
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

  public activateVenv(workspaceRoot: string, context?: ExecutorContext): void {
    if (!process.env.VIRTUAL_ENV) {
      if (!this.isWorkspace && !context) {
        throw new Error('context is required when not in a workspace');
      }

      const virtualEnv = path.resolve(
        this.isWorkspace
          ? workspaceRoot
          : context.projectsConfigurations.projects[context.projectName].root,
        '.venv',
      );
      process.env.VIRTUAL_ENV = virtualEnv;
      process.env.PATH = `${virtualEnv}/bin:${process.env.PATH}`;
      delete process.env.PYTHONHOME;
    }
  }

  private sources(
    projectPyprojectToml: UVPyprojectToml | undefined,
  ): UVPyprojectToml['tool']['uv']['sources'] {
    if (!this.isWorkspace) {
      return projectPyprojectToml?.tool?.uv?.sources ?? {};
    }

    const rootPyprojectToml = getPyprojectData<UVPyprojectToml>(
      joinPathFragments(this.workspaceRoot, 'pyproject.toml'),
    );
    return {
      ...(rootPyprojectToml?.tool?.uv?.sources ?? {}),
      ...(projectPyprojectToml?.tool?.uv?.sources ?? {}),
    };
  }

  private resolveDependencies(
    projectName: string,
    sources: UVPyprojectToml['tool']['uv']['sources'],
    projectData: ProjectConfiguration,
    dependencies: string[],
    category: string,
    projects: Record<string, ProjectConfiguration>,
  ) {
    const deps: Dependency[] = [];

    for (const dep of dependencies) {
      if (!sources[dep]) {
        continue;
      }

      if (this.isWorkspace) {
        this.appendWorkspaceDependencyToDeps(
          projectName,
          dep,
          category,
          sources,
          projects,
          deps,
        );
      } else {
        this.appendIndividualDependencyToDeps(
          projectData,
          dep,
          category,
          sources,
          projects,
          deps,
        );
      }
    }

    return deps;
  }

  private appendWorkspaceDependencyToDeps(
    projectName: string,
    dependencyName: string,
    category: string,
    sources: UVPyprojectToml['tool']['uv']['sources'],
    projects: Record<string, ProjectConfiguration>,
    deps: Dependency[],
  ): void {
    if (!sources[dependencyName]?.workspace) {
      return;
    }

    const packageMetadata = this.rootLockfile.package[projectName]?.metadata;

    const depMetadata =
      category === 'main'
        ? packageMetadata?.['requires-dist']?.[dependencyName]
        : packageMetadata?.['requires-dev']?.[category]?.[dependencyName];

    if (!depMetadata?.editable) {
      return;
    }

    const depProjectName = Object.keys(projects).find(
      (proj) =>
        path.normalize(projects[proj].root) ===
        path.normalize(depMetadata.editable),
    );

    if (!depProjectName) {
      return;
    }

    deps.push({ name: depProjectName, category });
  }

  private appendIndividualDependencyToDeps(
    projectData: ProjectConfiguration,
    dependencyName: string,
    category: string,
    sources: UVPyprojectToml['tool']['uv']['sources'],
    projects: Record<string, ProjectConfiguration>,
    deps: Dependency[],
  ) {
    if (!sources[dependencyName]?.path) {
      return;
    }

    const depAbsPath = path.resolve(
      projectData.root,
      sources[dependencyName].path,
    );
    const depProjectName = Object.keys(projects).find(
      (proj) =>
        path.normalize(projects[proj].root) ===
        path.normalize(path.relative(this.workspaceRoot, depAbsPath)),
    );

    if (!depProjectName) {
      return;
    }

    deps.push({ name: depProjectName, category });
  }

  private getProjectRoot(context: ExecutorContext) {
    return context.projectsConfigurations.projects[context.projectName].root;
  }

  private syncDependents(
    context: ExecutorContext,
    projectName: string,
    updatedProjects: string[] = [],
  ) {
    updatedProjects.push(projectName);
    const deps = this.getDependents(
      projectName,
      context.projectsConfigurations.projects,
    );

    for (const dep of deps) {
      if (updatedProjects.includes(dep)) {
        continue;
      }

      this.logger.info(chalk`\nUpdating project {bold ${dep}}`);
      const depConfig = context.projectsConfigurations.projects[dep];
      runUv(['sync'], {
        cwd: depConfig.root,
      });

      this.syncDependents(context, dep, updatedProjects);
    }
  }
}
