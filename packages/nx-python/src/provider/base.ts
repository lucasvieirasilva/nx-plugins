import { ExecutorContext, ProjectConfiguration, Tree } from '@nx/devkit';
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

export abstract class BaseProvider {
  constructor(
    protected readonly workspaceRoot: string,
    protected readonly logger: Logger,
    public readonly isWorkspace: boolean,
    public readonly lockFileName: string,
    protected readonly tree?: Tree,
  ) {}

  abstract checkPrerequisites(): Promise<void>;

  abstract getMetadata(projectRoot: string): ProjectMetadata;

  abstract getDependencyMetadata(
    projectRoot: string,
    dependencyName: string,
  ): DependencyProjectMetadata | null;

  abstract updateVersion(projectRoot: string, newVersion: string): void;

  abstract getDependencies(
    projectName: string,
    projects: Record<string, ProjectConfiguration>,
    cwd: string,
  ): Dependency[];

  abstract getDependents(
    projectName: string,
    projects: Record<string, ProjectConfiguration>,
    cwd: string,
  ): string[];

  abstract add(
    options: AddExecutorSchema,
    context: ExecutorContext,
  ): Promise<void>;

  abstract update(
    options: UpdateExecutorSchema,
    context: ExecutorContext,
  ): Promise<void>;

  abstract remove(
    options: RemoveExecutorSchema,
    context: ExecutorContext,
  ): Promise<void>;

  abstract publish(
    options: PublishExecutorSchema,
    context: ExecutorContext,
  ): Promise<void>;

  abstract install(
    options?: InstallExecutorSchema,
    context?: ExecutorContext,
  ): Promise<void>;

  abstract install(cwd?: string): Promise<void>;

  abstract lock(
    options?: LockExecutorSchema,
    context?: ExecutorContext,
  ): Promise<void>;

  abstract lock(
    projectRoot?: string,
    update?: boolean,
    args?: string[] | string,
  ): Promise<void>;

  abstract getLockCommand(
    projectRoot?: string,
    update?: boolean,
  ): Promise<string>;

  abstract sync(
    options?: SyncExecutorSchema,
    context?: ExecutorContext,
  ): Promise<void>;

  abstract build(
    options: BuildExecutorSchema,
    context: ExecutorContext,
  ): Promise<string>;

  abstract getRunCommand(args: string[]): Promise<string>;

  abstract run(
    args: string[],
    workspaceRoot: string,
    options: {
      log?: boolean;
      error?: boolean;
    } & SpawnSyncOptions,
    context?: ExecutorContext,
  ): Promise<void>;

  public async activateVenv(
    workspaceRoot: string,
    context?: ExecutorContext,
  ): Promise<void> {
    if (!process.env.VIRTUAL_ENV) {
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

      process.env.VIRTUAL_ENV = virtualEnv;
      process.env.PATH = `${virtualEnv}/bin:${process.env.PATH}`;
      delete process.env.PYTHONHOME;
    }
  }
}
