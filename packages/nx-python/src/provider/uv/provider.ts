import { ExecutorContext, ProjectConfiguration, Tree } from '@nx/devkit';
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
import { BuildExecutorSchema } from '../../executors/build/schema';
import { InstallExecutorSchema } from '../../executors/install/schema';

export class UVProvider implements IProvider {
  constructor(protected logger: Logger) {}

  public async checkPrerequisites(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  public getMetadata(projectRoot: string): ProjectMetadata {
    throw new Error('Method not implemented.');
  }

  public getDependencyMetadata(
    projectRoot: string,
    dependencyName: string,
    tree?: Tree,
  ): DependencyProjectMetadata {
    throw new Error('Method not implemented.');
  }

  public updateVersion(
    projectRoot: string,
    newVersion: string,
    tree?: Tree,
  ): void {
    throw new Error('Method not implemented.');
  }

  public getDependencies(
    projectName: string,
    projects: Record<string, ProjectConfiguration>,
    cwd: string,
  ): Dependency[] {
    throw new Error('Method not implemented.');
  }

  public getDependents(
    projectName: string,
    projects: Record<string, ProjectConfiguration>,
    cwd: string,
  ): string[] {
    throw new Error('Method not implemented.');
  }

  public async add(
    options: AddExecutorSchema,
    context: ExecutorContext,
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }

  public async update(
    options: UpdateExecutorSchema,
    context: ExecutorContext,
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }

  public async remove(
    options: RemoveExecutorSchema,
    context: ExecutorContext,
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }

  public async publish(
    options: PublishExecutorSchema,
    context: ExecutorContext,
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }

  public async install(
    options: InstallExecutorSchema,
    context: ExecutorContext,
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }

  public lock(projectRoot: string): Promise<void> {
    throw new Error('Method not implemented.');
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
    throw new Error('Method not implemented.');
  }

  public activateVenv(workspaceRoot: string): void {
    throw new Error('Method not implemented.');
  }
}
