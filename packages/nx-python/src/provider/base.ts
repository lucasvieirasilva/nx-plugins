import {
  ExecutorContext,
  joinPathFragments,
  ProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { AddExecutorSchema } from '../executors/add/schema';
import { SpawnSyncOptions } from 'child_process';
import { UpdateExecutorSchema } from '../executors/update/schema';
import { RemoveExecutorSchema } from '../executors/remove/schema';
import { PublishExecutorSchema } from '../executors/publish/schema';
import { InstallExecutorSchema } from '../executors/install/schema';
import { BuildExecutorSchema } from '../executors/build/schema';
import { LockExecutorSchema } from '../executors/lock/schema';
import { SyncExecutorSchema } from '../executors/sync/schema';
import { Logger } from '../executors/utils/logger';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { parse } from '@iarna/toml';
import { getPyprojectData, readPyprojectToml } from './utils';

export type Dependency = {
  name: string;
  category: string;
  version: string;
};

export type PackageDependency = {
  name: string;
  version?: string;
  markers?: string;
  optional?: boolean;
  extras?: string[];
  git?: string;
  rev?: string;
  source?: string;
};

export type ProjectMetadata = {
  name: string;
  version: string;
};

export type DependencyProjectMetadata = ProjectMetadata & {
  group?: string;
};

export type SyncGeneratorCallback = {
  actions: string[];
  description?: string;
  callback: () => Promise<void> | void;
};

export type SyncGeneratorResult = {
  callbacks: SyncGeneratorCallback[];
  outOfSyncMessage: string;
};

/**
 * Base class shared by the Poetry and uv providers. It abstracts away the
 * package-manager specific behavior (resolving metadata, managing dependencies,
 * locking, building, publishing, etc.) behind a common interface, while
 * providing a few filesystem helpers that transparently work against either a
 * real filesystem or an in-memory Nx {@link Tree}.
 *
 * @typeParam TPyprojectToml - The provider specific shape of `pyproject.toml`.
 */
export abstract class BaseProvider<TPyprojectToml> {
  /**
   * @param workspaceRoot - Absolute path to the workspace root.
   * @param logger - Logger used to surface progress messages to the user.
   * @param isWorkspace - Whether the provider operates on a shared workspace
   *   (single root lock file) rather than per-project environments.
   * @param lockFileName - The lock file name used by the package manager (e.g.
   *   `uv.lock` or `poetry.lock`).
   * @param tree - Optional Nx {@link Tree}. When provided, file reads/writes go
   *   through the in-memory tree (generators); otherwise the real filesystem is
   *   used (executors).
   */
  constructor(
    protected readonly workspaceRoot: string,
    protected readonly logger: Logger,
    public readonly isWorkspace: boolean,
    public readonly lockFileName: string,
    protected readonly tree?: Tree,
  ) {}

  /**
   * Ensures the package manager executable (and any other prerequisite) is
   * available before running a command. Throws if a prerequisite is missing.
   */
  abstract checkPrerequisites(): Promise<void>;

  /**
   * Reads and parses the `pyproject.toml` of a project, using the in-memory
   * {@link Tree} when available and falling back to the real filesystem.
   *
   * @param projectRoot - Project root containing the `pyproject.toml`.
   * @returns The parsed `pyproject.toml` contents.
   */
  public getPyprojectToml(projectRoot: string): TPyprojectToml {
    const pyprojectTomlPath = joinPathFragments(projectRoot, 'pyproject.toml');
    return this.tree
      ? readPyprojectToml<TPyprojectToml>(this.tree, pyprojectTomlPath)
      : getPyprojectData<TPyprojectToml>(pyprojectTomlPath);
  }

  /**
   * Checks whether a file exists, using the in-memory {@link Tree} when
   * available and falling back to the real filesystem.
   *
   * @param path - Path to check.
   */
  public fileExists(path: string): boolean {
    return this.tree ? this.tree.exists(path) : fs.existsSync(path);
  }

  /**
   * Resolves a project's own name and version from its manifest.
   *
   * @param projectRoot - Project root containing the `pyproject.toml`.
   */
  abstract getMetadata(projectRoot: string): ProjectMetadata;

  /**
   * Resolves the name, version and dependency group of a local dependency of a
   * project.
   *
   * @param projectRoot - Root of the project that declares the dependency.
   * @param dependencyName - Name of the dependency to resolve.
   * @returns The dependency metadata, or `null` when it cannot be resolved.
   */
  abstract getDependencyMetadata(
    projectRoot: string,
    dependencyName: string,
  ): DependencyProjectMetadata | null;

  /**
   * Writes a new version into a project's manifest.
   *
   * @param projectRoot - Project root containing the `pyproject.toml`.
   * @param newVersion - The version to write.
   */
  abstract updateVersion(projectRoot: string, newVersion: string): void;

  /**
   * Updates the version specifiers of local workspace dependencies within a
   * project's manifest so they reference the newly released versions.
   *
   * `dependencyVersions` is keyed by the dependency package name and maps to its
   * new version. Implementations should only rewrite dependencies that carry an
   * explicit version specifier and return a log message for each manifest that
   * was changed.
   */
  abstract updateDependencyVersions(
    projectRoot: string,
    dependencyVersions: Record<string, string>,
  ): string[];

  /**
   * Resolves the local workspace dependencies of a project from its manifest.
   *
   * @param projectName - Name of the project whose dependencies are resolved.
   * @param projects - Map of all project configurations in the workspace.
   * @param cwd - Working directory used to resolve relative dependency paths.
   * @returns The list of local dependencies (name, category and version).
   */
  abstract getDependencies(
    projectName: string,
    projects: Record<string, ProjectConfiguration>,
    cwd: string,
  ): Dependency[];

  /**
   * Returns the source/module folders of a project (e.g. the package
   * directories), used when copying source into a build artifact.
   *
   * @param projectRoot - Project root containing the `pyproject.toml`.
   */
  abstract getModulesFolders(projectRoot: string): string[];

  /**
   * Resolves the projects that depend on a given project (its dependents).
   *
   * @param projectName - Name of the project whose dependents are resolved.
   * @param projects - Map of all project configurations in the workspace.
   * @param cwd - Working directory used to resolve relative dependency paths.
   * @returns The names of the dependent projects.
   */
  abstract getDependents(
    projectName: string,
    projects: Record<string, ProjectConfiguration>,
    cwd: string,
  ): string[];

  /**
   * Exports a project's resolved dependencies to a `requirements.txt` file.
   *
   * @param cwd - Project directory to export from.
   * @param extras - Optional extras to include in the export.
   * @param outputPath - Optional output path (defaults to `requirements.txt`).
   * @returns The path to the written requirements file.
   */
  abstract writeProjectRequirementsTxt(
    cwd: string,
    extras?: string[],
    outputPath?: string,
  ): Promise<string>;

  /**
   * Adds a dependency to a project (external package or local project).
   *
   * @param options - Add executor options (name, group, extras, local, etc.).
   * @param context - The Nx executor context.
   */
  abstract add(
    options: AddExecutorSchema,
    context: ExecutorContext,
  ): Promise<void>;

  /**
   * Nx sync generator that keeps a project's manifest in sync with the
   * dependencies inferred from the project graph, returning the callbacks and
   * out-of-sync message Nx uses to apply and report the changes.
   *
   * @param projectName - Name of the project being synced.
   * @param missingDependencies - Dependencies missing from the manifest.
   * @param context - The Nx executor context.
   */
  abstract syncGenerator(
    projectName: string,
    missingDependencies: string[],
    context: ExecutorContext,
  ): Promise<SyncGeneratorResult>;

  /**
   * Updates dependencies of a project to newer versions.
   *
   * @param options - Update executor options (name, group, args, etc.).
   * @param context - The Nx executor context.
   */
  abstract update(
    options: UpdateExecutorSchema,
    context: ExecutorContext,
  ): Promise<void>;

  /**
   * Removes a dependency from a project.
   *
   * @param options - Remove executor options (name, etc.).
   * @param context - The Nx executor context.
   */
  abstract remove(
    options: RemoveExecutorSchema,
    context: ExecutorContext,
  ): Promise<void>;

  /**
   * Publishes a project's built distribution to a package repository.
   *
   * @param options - Publish executor options (repository, args, etc.).
   * @param context - The Nx executor context.
   */
  abstract publish(
    options: PublishExecutorSchema,
    context: ExecutorContext,
  ): Promise<void>;

  /**
   * Installs a project's dependencies / creates its virtual environment.
   *
   * @param options - Install executor options.
   * @param context - The Nx executor context.
   */
  abstract install(
    options?: InstallExecutorSchema,
    context?: ExecutorContext,
  ): Promise<void>;

  /**
   * Installs dependencies for the project rooted at `cwd`.
   *
   * @param cwd - Directory whose dependencies should be installed.
   */
  abstract install(cwd?: string): Promise<void>;

  /**
   * Regenerates the lock file from executor options/context.
   *
   * @param options - Lock executor options.
   * @param context - The Nx executor context.
   */
  abstract lock(
    options?: LockExecutorSchema,
    context?: ExecutorContext,
  ): Promise<void>;

  /**
   * Regenerates the lock file for a specific project.
   *
   * @param projectRoot - Project root to lock.
   * @param update - Whether to update dependencies while locking.
   * @param args - Additional arguments to pass to the lock command.
   */
  abstract lock(
    projectRoot?: string,
    update?: boolean,
    args?: string[] | string,
  ): Promise<void>;

  /**
   * Returns the shell command used to lock the given project, without running
   * it (used to display or compose commands).
   *
   * @param projectRoot - Project root to lock.
   * @param update - Whether to update dependencies while locking.
   */
  abstract getLockCommand(
    projectRoot?: string,
    update?: boolean,
  ): Promise<string>;

  /**
   * Synchronizes the environment with the lock file (installs the exact locked
   * versions).
   *
   * @param options - Sync executor options.
   * @param context - The Nx executor context.
   */
  abstract sync(
    options?: SyncExecutorSchema,
    context?: ExecutorContext,
  ): Promise<void>;

  /**
   * Builds a project's distribution, resolving and (optionally) bundling local
   * dependencies into the build folder.
   *
   * @param options - Build executor options, plus an optional `buildFolder`
   *   override and a `skipBuild` flag.
   * @param context - The Nx executor context.
   * @returns The path to the build output folder.
   */
  abstract build(
    options: BuildExecutorSchema & {
      buildFolder?: string;
      skipBuild?: boolean;
    },
    context: ExecutorContext,
  ): Promise<string>;

  /**
   * Returns the shell command used to run the given arguments within the
   * project's environment, without running it.
   *
   * @param args - Arguments to run.
   */
  abstract getRunCommand(args: string[]): Promise<string>;

  /**
   * Runs a command within the project's environment.
   *
   * @param args - Arguments to run.
   * @param workspaceRoot - Workspace root the command runs from.
   * @param options - Logging flags merged with `spawnSync` options.
   * @param installIfNotExists - Whether to create the environment first if it
   *   does not yet exist.
   * @param context - The Nx executor context.
   */
  abstract run(
    args: string[],
    workspaceRoot: string,
    options: {
      log?: boolean;
      error?: boolean;
    } & SpawnSyncOptions,
    installIfNotExists?: boolean,
    context?: ExecutorContext,
  ): Promise<void>;

  /**
   * Activates the project/workspace virtual environment for the current process
   * when one is not already active. For shared workspaces it honors the
   * `tool.nx.autoActivate` setting in the root `pyproject.toml`, and when
   * `installIfNotExists` is set it creates the environment first if needed.
   *
   * @param workspaceRoot - Workspace root used to locate the environment.
   * @param installIfNotExists - Whether to create the environment if missing.
   * @param context - The Nx executor context (required outside a workspace when
   *   `installIfNotExists` is set).
   */
  public async activateVenv(
    workspaceRoot: string,
    installIfNotExists = false,
    context?: ExecutorContext,
  ): Promise<void> {
    if (!process.env.VIRTUAL_ENV) {
      if (this.isWorkspace) {
        const rootPyproject = path.join(workspaceRoot, 'pyproject.toml');

        if (fs.existsSync(rootPyproject)) {
          const rootConfig = parse(fs.readFileSync(rootPyproject, 'utf-8')) as {
            tool?: {
              nx?: {
                autoActivate?: boolean;
              };
            };
          };
          const autoActivate = rootConfig.tool.nx?.autoActivate ?? false;
          if (autoActivate) {
            console.log(
              chalk`\n{bold shared virtual environment detected and not activated, activating...}\n\n`,
            );
            const virtualEnv = path.resolve(workspaceRoot, '.venv');
            this.setVenvEnvironmentVariables(virtualEnv);
          }
        }
      }

      if (installIfNotExists) {
        if (!this.isWorkspace && !context) {
          throw new Error('context is required when not in a workspace');
        }

        const projectRoot =
          context?.projectsConfigurations?.projects[context?.projectName]?.root;
        const baseDir = this.isWorkspace ? workspaceRoot : projectRoot;

        const virtualEnv = path.resolve(baseDir, '.venv');
        if (!fs.existsSync(virtualEnv)) {
          this.logger.info(
            chalk`\n  {bold Creating virtual environment in {bgBlue  ${baseDir} }...}\n`,
          );
          await this.install(baseDir);
        }

        this.setVenvEnvironmentVariables(virtualEnv);
      }
    }
  }

  /**
   * Points the current process at the given virtual environment by setting
   * `VIRTUAL_ENV`, prepending its `bin` directory to `PATH`, and clearing
   * `PYTHONHOME`.
   *
   * @param virtualEnvPath - Absolute path to the virtual environment.
   */
  private setVenvEnvironmentVariables(virtualEnvPath: string) {
    process.env.VIRTUAL_ENV = virtualEnvPath;
    process.env.PATH = `${virtualEnvPath}/bin:${process.env.PATH}`;
    delete process.env.PYTHONHOME;
  }
}
