import { ExecutorContext, ProjectConfiguration } from '@nx/devkit';
import { AddExecutorSchema } from '../executors/add/schema';
import { SpawnSyncOptions } from 'child_process';
import { UpdateExecutorSchema } from '../executors/update/schema';
import { RemoveExecutorSchema } from '../executors/remove/schema';
import { PublishExecutorSchema } from '../executors/publish/schema';
import { InstallExecutorSchema } from '../executors/install/schema';
import { BuildExecutorSchema } from '../executors/build/schema';

export type Dependency = {
  name: string;
  category: string;
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

export interface IProvider {
  checkPrerequisites(): Promise<void>;

  getMetadata(projectRoot: string): ProjectMetadata;

  getDependencyMetadata(
    projectRoot: string,
    dependencyName: string,
  ): DependencyProjectMetadata;

  updateVersion(projectRoot: string, newVersion: string): void;

  getDependencies(
    projectName: string,
    projects: Record<string, ProjectConfiguration>,
    cwd: string,
  ): Dependency[];

  getDependents(
    projectName: string,
    projects: Record<string, ProjectConfiguration>,
    cwd: string,
  ): string[];

  add(options: AddExecutorSchema, context: ExecutorContext): Promise<void>;

  update(
    options: UpdateExecutorSchema,
    context: ExecutorContext,
  ): Promise<void>;

  remove(
    options: RemoveExecutorSchema,
    context: ExecutorContext,
  ): Promise<void>;

  publish(
    options: PublishExecutorSchema,
    context: ExecutorContext,
  ): Promise<void>;

  install(
    options: InstallExecutorSchema,
    context: ExecutorContext,
  ): Promise<void>;

  lock(projectRoot: string): Promise<void>;

  build(
    options: BuildExecutorSchema,
    context: ExecutorContext,
  ): Promise<string>;

  run(
    args: string[],
    workspaceRoot: string,
    options: {
      log?: boolean;
      error?: boolean;
    } & SpawnSyncOptions,
  ): Promise<void>;

  activateVenv(workspaceRoot: string, context?: ExecutorContext): void;
}
