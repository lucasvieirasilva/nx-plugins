import {
  ExecutorContext,
  ProjectConfiguration,
  ProjectsConfigurations,
  Tree,
  joinPathFragments,
  runExecutor,
} from '@nx/devkit';
import {
  Dependency,
  DependencyProjectMetadata,
  BaseProvider,
  ProjectMetadata,
  SyncGeneratorResult,
  SyncGeneratorCallback,
} from '../base';
import fs from 'fs';
import path, { join } from 'path';
import { PoetryPyprojectToml, PoetryPyprojectTomlDependencies } from './types';
import { AddExecutorSchema } from '../../executors/add/schema';
import {
  addLocalProjectToPoetryProject,
  checkPoetryExecutable,
  getAllDependenciesFromPyprojectToml,
  getPoetryVersion,
  getProjectTomlPath,
  parseToml,
  POETRY_EXECUTABLE,
  runPoetry,
  RunPoetryOptions,
} from './utils';
import chalk from 'chalk';
import { parse, stringify } from '@iarna/toml';
import { SpawnSyncOptions } from 'child_process';
import { RemoveExecutorSchema } from '../../executors/remove/schema';
import { UpdateExecutorSchema } from '../../executors/update/schema';
import { PublishExecutorSchema } from '../../executors/publish/schema';
import {
  BuildExecutorOutput,
  BuildExecutorSchema,
} from '../../executors/build/schema';
import { Logger } from '../../executors/utils/logger';
import { spawnPromise } from '../../executors/utils/cmd';
import { InstallExecutorSchema } from '../../executors/install/schema';
import { tmpdir } from 'os';
import { v4 as uuid } from 'uuid';
import {
  readdirSync,
  copySync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  removeSync,
} from 'fs-extra';
import {
  LockedDependencyResolver,
  ProjectDependencyResolver,
} from './build/resolvers';
import {
  getLocalDependencyConfig,
  readPyprojectToml,
  writePyprojectToml,
} from '../utils';
import semver from 'semver';
import { LockExecutorSchema } from '../../executors/lock/schema';
import { SyncExecutorSchema } from '../../executors/sync/schema';
import { minimatch } from 'minimatch';
import assert from 'node:assert';

export class PoetryProvider extends BaseProvider<PoetryPyprojectToml> {
  constructor(workspaceRoot: string, logger: Logger, tree?: Tree) {
    const isWorkspace = tree
      ? tree.exists(joinPathFragments(workspaceRoot, 'pyproject.toml'))
      : fs.existsSync(joinPathFragments(workspaceRoot, 'pyproject.toml'));

    super(workspaceRoot, logger, isWorkspace, 'poetry.lock', tree);
  }

  public async checkPrerequisites(): Promise<void> {
    await checkPoetryExecutable();
  }

  public getMetadata(projectRoot: string): ProjectMetadata {
    const projectData = this.getPyprojectToml(projectRoot);

    return {
      name: projectData?.tool?.poetry?.name,
      version: projectData?.tool?.poetry?.version,
    };
  }

  public getModulesFolders(projectRoot: string): string[] {
    const projectData = this.getPyprojectToml(projectRoot);

    return (
      projectData?.tool?.poetry?.packages?.map((pkg) =>
        join(projectRoot, pkg.include),
      ) ?? []
    );
  }

  public updateVersion(projectRoot: string, newVersion: string): void {
    const pyprojectTomlPath = joinPathFragments(projectRoot, 'pyproject.toml');
    const projectData = this.getPyprojectToml(projectRoot);

    if (!projectData.tool?.poetry) {
      throw new Error('Poetry section not found in pyproject.toml');
    }
    projectData.tool.poetry.version = newVersion;

    if (this.tree) {
      writePyprojectToml(this.tree, pyprojectTomlPath, projectData);
    } else {
      writeFileSync(pyprojectTomlPath, stringify(projectData));
    }
  }

  public getDependencyMetadata(
    projectRoot: string,
    dependencyName: string,
  ): DependencyProjectMetadata | null {
    const projectData = this.getPyprojectToml(projectRoot);

    const main = projectData?.tool?.poetry?.dependencies ?? {};
    if (typeof main[dependencyName] === 'object' && main[dependencyName].path) {
      const dependentPyproject = readPyprojectToml<PoetryPyprojectToml>(
        this.tree,
        joinPathFragments(
          projectRoot,
          main[dependencyName].path,
          'pyproject.toml',
        ),
      );

      return {
        name: dependentPyproject.tool?.poetry?.name,
        version: dependentPyproject.tool?.poetry?.version,
        group: 'main',
      };
    }

    for (const key in projectData?.tool?.poetry?.group ?? {}) {
      const group = projectData?.tool?.poetry?.group?.[key].dependencies;

      if (
        typeof group[dependencyName] === 'object' &&
        group[dependencyName].path
      ) {
        const depPyprojectTomlPath = joinPathFragments(
          projectRoot,
          group[dependencyName].path,
          'pyproject.toml',
        );

        const dependentPyproject = readPyprojectToml<PoetryPyprojectToml>(
          this.tree,
          depPyprojectTomlPath,
        );

        return {
          name: dependentPyproject.tool?.poetry?.name,
          version: dependentPyproject.tool?.poetry?.version,
          group: key,
        };
      }
    }

    return null;
  }

  public getDependencies(
    projectName: string,
    projects: Record<string, ProjectConfiguration>,
    cwd: string,
  ): Dependency[] {
    const projectData = projects[projectName];
    const pyprojectToml = joinPathFragments(projectData.root, 'pyproject.toml');

    const deps: Dependency[] = [];

    if (this.fileExists(pyprojectToml)) {
      const tomlData = this.getPyprojectToml(projectData.root);

      deps.push(
        ...this.resolveDependencies(
          tomlData.tool?.poetry?.dependencies,
          projectData,
          projects,
          cwd,
          'main',
        ),
      );
      for (const group in tomlData.tool?.poetry?.group || {}) {
        deps.push(
          ...this.resolveDependencies(
            tomlData.tool.poetry.group[group].dependencies,
            projectData,
            projects,
            cwd,
            group,
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
    const deps: string[] = [];

    const { root } = projects[projectName];

    for (const project in projects) {
      if (this.checkProjectIsDependent(projects, project, root, cwd)) {
        deps.push(project);
      }
    }

    return deps;
  }

  public async writeProjectRequirementsTxt(
    cwd: string,
    extras?: string[],
    outputPath?: string,
  ): Promise<string> {
    await this.lock(cwd);

    const exportArgs = [
      'export',
      '--format',
      'requirements.txt',
      '--without-hashes',
      '--without-urls',
      '--output',
      outputPath ?? 'requirements.txt',
    ];

    if (extras?.length) {
      for (const extra of extras) {
        exportArgs.push('--extras', extra);
      }
    }

    runPoetry(exportArgs, { cwd, log: false });

    return outputPath ?? 'requirements.txt';
  }

  public async add(
    options: AddExecutorSchema,
    context: ExecutorContext,
  ): Promise<void> {
    await this.activateVenv(
      context.root,
      options.installDependenciesIfNotExists ?? false,
      context,
    );
    await checkPoetryExecutable();
    const projectConfig =
      context.projectsConfigurations.projects[context.projectName];
    const rootPyprojectToml = this.fileExists('pyproject.toml');

    if (options.local) {
      this.logger.info(
        chalk`\n  {bold Adding {bgBlue  ${options.name} } workspace dependency...}\n`,
      );
      await this.updateLocalProject(
        context,
        options.name,
        projectConfig,
        rootPyprojectToml,
        false,
        options.group,
        options.extras,
      );
    } else {
      this.logger.info(
        chalk`\n  {bold Adding {bgBlue  ${options.name} } dependency...}\n`,
      );
      const installArgs = ['add', options.name]
        .concat(options.group ? ['--group', options.group] : [])
        .concat(options.args ? options.args.split(' ') : [])
        .concat(
          options.extras ? options.extras.map((ex) => `--extras=${ex}`) : [],
        )
        .concat(rootPyprojectToml ? ['--lock'] : []);

      runPoetry(installArgs, { cwd: projectConfig.root });
    }

    await this.updateDependencyTree(context);

    this.logger.info(
      chalk`\n  {green.bold '${options.name}'} {green dependency has been successfully added to the project}\n`,
    );
  }

  public async syncGenerator(
    projectName: string,
    missingDependencies: string[],
    context: ExecutorContext,
  ): Promise<SyncGeneratorResult> {
    let outOfSyncMessage = '';
    await checkPoetryExecutable();
    assert(this.tree, 'Tree is required');

    const callbacks: SyncGeneratorCallback[] = [
      {
        actions: ['activate-venv'],
        description: 'Activating virtual environment',
        callback: async () =>
          await this.activateVenv(context.root, false, context),
      },
    ];
    const projectConfig =
      context.projectsConfigurations.projects[context.projectName];

    const rootPyprojectTomlExists = this.tree.exists('pyproject.toml');

    for (const dependency of missingDependencies) {
      callbacks.push(
        await this.updateLocalProject(
          context,
          dependency,
          projectConfig,
          rootPyprojectTomlExists,
          true,
          undefined,
          undefined,
          this.tree,
        ),
      );
    }
    if (this.isWorkspace) {
      const rootPyprojectToml = readPyprojectToml<PoetryPyprojectToml>(
        this.tree,
        'pyproject.toml',
      );
      if (!rootPyprojectToml.tool?.poetry?.dependencies?.[projectName]) {
        rootPyprojectToml.tool.poetry.dependencies ??= {};
        rootPyprojectToml.tool.poetry.dependencies[projectName] = {
          path: projectConfig.root,
          develop: true,
        };
        writePyprojectToml(this.tree, 'pyproject.toml', rootPyprojectToml);
        outOfSyncMessage += `Root pyproject.toml is out of sync. Missing dependency: ${projectName}\n`;

        if (missingDependencies.length === 0) {
          callbacks.push({
            actions: ['lock-root'],
            description: 'Locking/Installing root project',
            callback: async () => {
              await this.lock(context.root, false);
              await this.install({
                debug: false,
                silent: false,
                verbose: false,
                args: '--no-root',
              });
            },
          });
        }
      }
    }

    if (missingDependencies.length > 0) {
      callbacks.push({
        actions: [`update-dependency-tree-${context.projectName}`, 'lock-root'],
        description: 'Updating dependency tree',
        callback: async () => await this.updateDependencyTree(context),
      });
    }
    return {
      callbacks,
      outOfSyncMessage,
    };
  }

  public async update(
    options: UpdateExecutorSchema,
    context: ExecutorContext,
  ): Promise<void> {
    await this.activateVenv(
      context.root,
      options.installDependenciesIfNotExists ?? false,
      context,
    );
    await checkPoetryExecutable();
    const projectConfig =
      context.projectsConfigurations.projects[context.projectName];
    const rootPyprojectToml = this.fileExists('pyproject.toml');

    if (options.local && options.name) {
      this.logger.info(
        chalk`\n  {bold Updating {bgBlue  ${options.name} } workspace dependency...}\n`,
      );

      if (
        !Object.keys(context.projectsConfigurations.projects).some(
          (projectName) => options.name === projectName,
        )
      ) {
        throw new Error(
          chalk`\n  {red.bold ${options.name}} workspace project does not exist\n`,
        );
      }

      await this.updateProject(projectConfig.root, rootPyprojectToml);
    } else {
      if (options.name) {
        this.logger.info(
          chalk`\n  {bold Updating {bgBlue  ${options.name} } dependency...}\n`,
        );
      } else {
        this.logger.info(chalk`\n  {bold Updating project dependencies...}\n`);
      }

      const updateArgs = ['update']
        .concat(options.name ? [options.name] : [])
        .concat(options.args ? options.args.split(' ') : [])
        .concat(rootPyprojectToml ? ['--lock'] : []);
      runPoetry(updateArgs, { cwd: projectConfig.root });
    }

    await this.updateDependencyTree(context);

    this.logger.info(
      chalk`\n  {green.bold '${options.name}'} {green dependency has been successfully added to the project}\n`,
    );
  }

  public async remove(
    options: RemoveExecutorSchema,
    context: ExecutorContext,
  ): Promise<void> {
    await this.activateVenv(
      context.root,
      options.installDependenciesIfNotExists ?? false,
      context,
    );
    await checkPoetryExecutable();
    const rootPyprojectToml = this.fileExists('pyproject.toml');
    const projectConfig =
      context.projectsConfigurations.projects[context.projectName];
    this.logger.info(
      chalk`\n  {bold Removing {bgBlue  ${options.name} } dependency...}\n`,
    );

    let dependencyName = options.name;
    if (options.local) {
      const dependencyConfig = getLocalDependencyConfig(context, options.name);

      const pyprojectTomlPath = getProjectTomlPath(dependencyConfig);
      const {
        tool: {
          poetry: { name },
        },
      } = parseToml(pyprojectTomlPath);

      dependencyName = name;
    }

    const poetryVersion = await getPoetryVersion(context);
    const hasLockOption = semver.gte(poetryVersion, '1.5.0');

    const removeArgs = ['remove', dependencyName]
      .concat(options.args ? options.args.split(' ') : [])
      .concat(rootPyprojectToml && hasLockOption ? ['--lock'] : []);
    runPoetry(removeArgs, { cwd: projectConfig.root });

    await this.updateDependencyTree(context);

    this.logger.info(
      chalk`\n  {green.bold '${options.name}'} {green dependency has been successfully removed}\n`,
    );
  }

  public async publish(
    options: PublishExecutorSchema,
    context: ExecutorContext,
  ): Promise<void> {
    let buildFolderPath = '';

    try {
      await this.activateVenv(
        context.root,
        options.installDependenciesIfNotExists ?? false,
        context,
      );
      await checkPoetryExecutable();

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

      const commandArgs = [
        'publish',
        ...(options.dryRun ? ['--dry-run'] : []),
        ...(options.__unparsed__ ?? []),
      ];

      if (options.repository) {
        commandArgs.push('--repository', options.repository);
      }

      const commandStr = `${POETRY_EXECUTABLE} ${commandArgs.join(' ')}`;

      this.logger.info(
        chalk`{bold Running command}: ${commandStr} ${
          buildFolderPath && buildFolderPath !== '.'
            ? chalk`at {bold ${buildFolderPath}} folder`
            : ''
        }\n`,
      );

      await spawnPromise(commandStr, buildFolderPath);
      removeSync(buildFolderPath);
    } catch (error) {
      if (buildFolderPath) {
        removeSync(buildFolderPath);
      }

      if (typeof error === 'object' && 'code' in error && 'output' in error) {
        if (error.code !== 0 && error.output.includes('File already exists')) {
          this.logger.info(
            chalk`\n  {bgYellow.bold  WARNING } {bold The package is already published}\n`,
          );

          return;
        }
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
    await checkPoetryExecutable();
    const projectConfig =
      context?.projectsConfigurations?.projects?.[context?.projectName];
    let verboseArg = '-v';

    const installArgs: string[] = ['install'];

    const execOpts: RunPoetryOptions = {};

    if (optionsOrCwd && typeof optionsOrCwd === 'object') {
      const options = optionsOrCwd;
      if (options.debug) {
        verboseArg = '-vvv';
      } else if (options.verbose) {
        verboseArg = '-vv';
      }

      installArgs.push(...(options.args ? options.args.split(' ') : []));
      if (projectConfig?.root) {
        execOpts.cwd = projectConfig?.root;
      }

      if (options?.cacheDir) {
        execOpts.env = {
          ...process.env,
          POETRY_CACHE_DIR: path.resolve(options.cacheDir),
        };
      }
    } else if (optionsOrCwd && typeof optionsOrCwd === 'string') {
      execOpts.cwd = optionsOrCwd;
    }

    runPoetry([...installArgs, verboseArg], execOpts);
  }

  public async getLockCommand(
    projectRoot?: string,
    update?: boolean,
  ): Promise<string> {
    const poetryVersion = await getPoetryVersion(projectRoot);
    if (semver.lt(poetryVersion, '2.0.0')) {
      return `${POETRY_EXECUTABLE} lock${update ? '' : ' --no-update'}`;
    } else {
      return `${POETRY_EXECUTABLE} lock${update ? ' --regenerate' : ''}`;
    }
  }

  public async lock(
    options?: LockExecutorSchema,
    context?: ExecutorContext,
  ): Promise<void>;

  public async lock(
    projectRoot?: string,
    update?: boolean,
    args?: string[] | string,
  ): Promise<void>;

  public async lock(
    optionsOrprojectRoot?: LockExecutorSchema | string,
    contextOrUpdate?: ExecutorContext | boolean,
    args?: string[] | string,
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

      const lockCommand = await this.getLockCommand(
        projectConfig.root,
        options.update,
      );

      const args = lockCommand.split(' ').slice(1);
      if (options.args) {
        args.push(...options.args.split(' '));
      }

      if (options.verbose) {
        args.push('-v');
      } else if (options.debug) {
        args.push('-vvv');
      }

      const execOptions: RunPoetryOptions = { cwd: projectConfig.root };

      if (options.cacheDir) {
        execOptions.env = {
          ...process.env,
          POETRY_CACHE_DIR: path.resolve(options.cacheDir),
        };
      }

      if (options.silent) {
        execOptions.log = false;
      }

      runPoetry(args, execOptions);
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

      const lockArgs = lockCommand.split(' ').slice(1);
      if (args) {
        lockArgs.push(...(Array.isArray(args) ? args : args.split(' ')));
      }

      runPoetry(
        lockArgs,
        optionsOrprojectRoot ? { cwd: optionsOrprojectRoot } : undefined,
      );
    } else {
      const updateOption =
        contextOrUpdate === undefined ? false : (contextOrUpdate as boolean);

      const lockCommand = await this.getLockCommand(undefined, updateOption);
      runPoetry(lockCommand.split(' ').slice(1));
    }
  }

  public async sync(
    options?: SyncExecutorSchema,
    context?: ExecutorContext,
  ): Promise<void> {
    await this.checkPrerequisites();

    const projectConfig =
      context?.projectsConfigurations?.projects?.[context?.projectName];
    if (!projectConfig) {
      throw new Error(
        `Project ${context?.projectName} not found in the workspace`,
      );
    }

    const poetryVersion = await getPoetryVersion(projectConfig.root);
    const args = semver.lt(poetryVersion, '2.0.0')
      ? ['install', '--sync']
      : ['sync'];

    if (options?.args) {
      args.push(...options.args.split(' '));
    }

    if (options?.verbose) {
      args.push('-v');
    } else if (options?.debug) {
      args.push('-vvv');
    }

    const execOptions: RunPoetryOptions = { cwd: projectConfig.root };

    if (options?.cacheDir) {
      execOptions.env = {
        ...process.env,
        POETRY_CACHE_DIR: path.resolve(options.cacheDir),
      };
    }

    if (options?.silent) {
      execOptions.log = false;
    }

    runPoetry(args, execOptions);
  }

  public async build(
    options: BuildExecutorSchema & {
      skipBuild?: boolean;
      buildFolder?: string;
    },
    context: ExecutorContext,
  ): Promise<string> {
    await this.activateVenv(
      context.root,
      options.installDependenciesIfNotExists ?? false,
      context,
    );
    await checkPoetryExecutable();
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

    const buildFolderPath =
      options.buildFolder ?? join(tmpdir(), 'nx-python', 'build', uuid());

    mkdirSync(buildFolderPath, { recursive: true });

    this.logger.info(chalk`  Copying project files to a temporary folder`);
    readdirSync(root).forEach((file) => {
      if (
        !options.ignorePaths.some((pattern) =>
          minimatch(file, pattern, { dot: true }),
        )
      ) {
        const source = join(root, file);
        const target = join(buildFolderPath, file);
        copySync(source, target);
      }
    });

    const buildPyProjectToml = join(buildFolderPath, 'pyproject.toml');

    let buildTomlData = parse(
      readFileSync(buildPyProjectToml).toString('utf-8'),
    ) as PoetryPyprojectToml;

    buildTomlData.tool.poetry.dependencies ??= {};

    // Remove the dev group if it exists
    if (buildTomlData.tool?.poetry?.group?.dev) {
      buildTomlData.tool.poetry.group.dev = {
        dependencies: {},
      };
    }

    buildTomlData = options.lockedVersions
      ? new LockedDependencyResolver(this.logger, options, context).apply(
          root,
          buildFolderPath,
          buildTomlData,
          options.devDependencies,
          context.root,
        )
      : new ProjectDependencyResolver(this.logger, options, context).apply(
          root,
          buildFolderPath,
          buildTomlData,
        );

    writeFileSync(buildPyProjectToml, stringify(buildTomlData));
    const distFolder = join(buildFolderPath, 'dist');

    removeSync(distFolder);

    if (!options.skipBuild) {
      this.logger.info(chalk`  Generating sdist and wheel artifacts`);
      const buildArgs = ['build'];
      if (options.format) {
        buildArgs.push('--format', options.format);
      }

      runPoetry(buildArgs, { cwd: buildFolderPath });

      removeSync(options.outputPath);
      mkdirSync(options.outputPath, { recursive: true });
      this.logger.info(
        chalk`  Artifacts generated at {bold ${options.outputPath}} folder`,
      );
      copySync(distFolder, options.outputPath);
    }

    if (!options.keepBuildFolder) {
      removeSync(buildFolderPath);
    }

    return buildFolderPath;
  }

  public async getRunCommand(args: string[]): Promise<string> {
    return `${POETRY_EXECUTABLE} run ${args.join(' ')}`;
  }

  public async run(
    args: string[],
    workspaceRoot: string,
    options: {
      log?: boolean;
      error?: boolean;
    } & SpawnSyncOptions,
    installIfNotExists?: boolean,
    context?: ExecutorContext,
  ): Promise<void> {
    await this.activateVenv(
      workspaceRoot,
      installIfNotExists ?? false,
      context,
    );
    await checkPoetryExecutable();

    runPoetry(['run', ...args], options);
  }

  private async updateLocalProject(
    context: ExecutorContext,
    dependencyName: string,
    projectConfig: ProjectConfiguration,
    updateLockOnly: boolean,
    callback = false,
    group?: string,
    extras?: string[],
    tree?: Tree,
  ): Promise<SyncGeneratorCallback> {
    const dependencyConfig = getLocalDependencyConfig(context, dependencyName);

    const dependencyPath = path.relative(
      projectConfig.root,
      dependencyConfig.root,
    );

    addLocalProjectToPoetryProject(
      projectConfig,
      dependencyConfig,
      dependencyPath,
      group,
      extras,
      tree,
    );
    if (callback) {
      return {
        actions: [`update-project-${projectConfig.root}`],
        description: `Updating project ${projectConfig.root}`,
        callback: async () => {
          await this.updateProject(projectConfig.root, updateLockOnly);
        },
      };
    } else {
      await this.updateProject(projectConfig.root, updateLockOnly);
    }
  }

  private async updateDependencyTree(context: ExecutorContext) {
    const rootPyprojectToml = this.fileExists('pyproject.toml');
    const projectConfig =
      context.projectsConfigurations.projects[context.projectName];

    const {
      tool: {
        poetry: { name: pkgName },
      },
    } = this.getPyprojectToml(projectConfig.root);

    await this.updateDependents(
      context,
      context.projectsConfigurations,
      context.projectName,
      rootPyprojectToml,
      context.root,
    );

    if (rootPyprojectToml) {
      const rootPyprojectToml = this.getPyprojectToml(context.root);
      const allRootDependencyNames = Object.keys(
        getAllDependenciesFromPyprojectToml(rootPyprojectToml),
      );

      if (allRootDependencyNames.includes(pkgName)) {
        this.logger.info(
          chalk`\nUpdating root {bold pyproject.toml} dependency {bold ${pkgName}}`,
        );

        await this.lock();
        await this.install({
          debug: false,
          silent: false,
          verbose: false,
          args: '--no-root',
        });
      }
    }
  }

  private async updateDependents(
    context: ExecutorContext,
    workspace: ProjectsConfigurations,
    projectName: string,
    updateLockOnly: boolean,
    workspaceRoot: string,
    updatedProjects: string[] = [],
  ) {
    updatedProjects.push(projectName);
    const deps = this.getDependents(
      projectName,
      workspace.projects,
      workspaceRoot,
    );

    for (const dep of deps) {
      if (updatedProjects.includes(dep)) {
        continue;
      }

      this.logger.info(chalk`\nUpdating project {bold ${dep}}`);
      const depConfig = workspace.projects[dep];

      await this.updateProject(depConfig.root, updateLockOnly);
      await this.updateDependents(
        context,
        workspace,
        dep,
        updateLockOnly,
        workspaceRoot,
        updatedProjects,
      );
    }
  }

  private checkProjectIsDependent(
    projects: Record<string, ProjectConfiguration>,
    project: string,
    root: string,
    cwd: string,
  ): boolean {
    const projectData = projects[project];
    const pyprojectToml = joinPathFragments(projectData.root, 'pyproject.toml');

    if (this.fileExists(pyprojectToml)) {
      const tomlData = this.getPyprojectToml(projectData.root);

      let isDep = this.isProjectDependent(
        tomlData.tool?.poetry?.dependencies,
        projectData,
        root,
        cwd,
      );

      if (isDep) return true;

      for (const group in tomlData.tool?.poetry?.group || {}) {
        isDep = this.isProjectDependent(
          tomlData.tool.poetry.group[group].dependencies,
          projectData,
          root,
          cwd,
        );

        if (isDep) return true;
      }
    }

    return false;
  }

  private isProjectDependent = (
    dependencies: PoetryPyprojectTomlDependencies,
    projectData: ProjectConfiguration,
    root: string,
    cwd: string,
  ): boolean => {
    for (const dep in dependencies || {}) {
      const depData = dependencies[dep];

      if (depData instanceof Object && depData.path) {
        const depAbsPath = path.resolve(projectData.root, depData.path);

        if (
          path.normalize(root) ===
          path.normalize(path.relative(cwd, depAbsPath))
        ) {
          return true;
        }
      }
    }
    return false;
  };

  private resolveDependencies(
    dependencies: PoetryPyprojectTomlDependencies,
    projectData: ProjectConfiguration,
    projects: Record<string, ProjectConfiguration>,
    cwd: string,
    category: string,
  ) {
    const deps: Dependency[] = [];

    for (const dep in dependencies || {}) {
      const depData = dependencies[dep];

      if (depData instanceof Object && depData.path) {
        const depAbsPath = path.resolve(projectData.root, depData.path);
        const depProjectName = Object.keys(projects).find(
          (proj) =>
            path.normalize(projects[proj].root) ===
            path.normalize(path.relative(cwd, depAbsPath)),
        );

        if (depProjectName) {
          const pyprojectToml = this.getPyprojectToml(
            projects[depProjectName].root,
          );

          deps.push({
            name: depProjectName,
            category,
            version: pyprojectToml.tool?.poetry?.version,
          });
        }
      }
    }

    return deps;
  }

  private async updateProject(cwd: string, updateLockOnly: boolean) {
    await this.lock(cwd);
    if (!updateLockOnly) {
      await this.install(cwd);
    }
  }
}
