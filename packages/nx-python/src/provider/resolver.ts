import fs from 'fs';
import path from 'path';
import { IProvider } from './base';
import { UVProvider } from './uv';
import { PoetryProvider, PoetryPyprojectToml } from './poetry';
import { Logger } from '../executors/utils/logger';
import { ExecutorContext, joinPathFragments, Tree } from '@nx/devkit';
import { getPyprojectData } from './utils';
import { UVPyprojectToml } from './uv/types';
import { PluginOptions } from '../types';

export const getProvider = async (
  workspaceRoot: string,
  logger?: Logger,
  tree?: Tree,
  context?: ExecutorContext,
  options?: PluginOptions,
): Promise<IProvider> => {
  const loggerInstance = logger ?? new Logger();

  if (options?.packageManager) {
    switch (options.packageManager) {
      case 'poetry':
        return new UVProvider(workspaceRoot, loggerInstance, tree);
      case 'uv':
        return new UVProvider(workspaceRoot, loggerInstance, tree);
      default:
        throw new Error(
          `Plugin option "packageManager" must be either "poetry" or "uv". Received "${options.packageManager}".`,
        );
    }
  }

  const uv = isUv(workspaceRoot, context, tree);
  const poetry = isPoetry(workspaceRoot, context, tree);
  if (uv && poetry) {
    throw new Error(
      'Both poetry.lock and uv.lock files found. Please remove one of them.',
    );
  }

  if (uv) {
    return new UVProvider(workspaceRoot, loggerInstance, tree);
  } else {
    return new PoetryProvider(workspaceRoot, loggerInstance, tree);
  }
};

function isUv(workspaceRoot: string, context?: ExecutorContext, tree?: Tree) {
  if (context) {
    const pyprojectTomlPath = joinPathFragments(
      context.projectsConfigurations.projects[context.projectName].root,
      'pyproject.toml',
    );

    if (fs.existsSync(pyprojectTomlPath)) {
      const projectData = getPyprojectData<
        PoetryPyprojectToml | UVPyprojectToml
      >(pyprojectTomlPath);

      return (
        'project' in projectData && !('poetry' in (projectData.tool ?? {}))
      );
    }
  }

  const lockPath = path.join(workspaceRoot, 'uv.lock');
  return tree ? tree.exists(lockPath) : fs.existsSync(lockPath);
}

function isPoetry(
  workspaceRoot: string,
  context?: ExecutorContext,
  tree?: Tree,
) {
  if (context) {
    const pyprojectTomlPath = joinPathFragments(
      context.projectsConfigurations.projects[context.projectName].root,
      'pyproject.toml',
    );

    if (fs.existsSync(pyprojectTomlPath)) {
      const projectData = getPyprojectData<
        PoetryPyprojectToml | UVPyprojectToml
      >(pyprojectTomlPath);

      return 'poetry' in (projectData.tool ?? {});
    }
  }

  const lockPath = path.join(workspaceRoot, 'poetry.lock');
  return tree ? tree.exists(lockPath) : fs.existsSync(lockPath);
}
