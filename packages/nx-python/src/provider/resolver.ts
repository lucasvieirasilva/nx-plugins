import fs from 'fs';
import path from 'path';
import { IProvider } from './base';
import { UVProvider } from './uv';
import { PoetryProvider } from './poetry';
import { Logger } from '../executors/utils/logger';
import { Tree } from '@nx/devkit';

export const getProvider = async (
  workspaceRoot: string,
  logger?: Logger,
  tree?: Tree,
): Promise<IProvider> => {
  const loggerInstance = logger ?? new Logger();

  const uvLockPath = path.join(workspaceRoot, 'uv.lock');
  const poetryLockPath = path.join(workspaceRoot, 'poetry.lock');

  const isUv = tree ? tree.exists(uvLockPath) : fs.existsSync(uvLockPath);
  const isPoetry = tree
    ? tree.exists(poetryLockPath)
    : fs.existsSync(poetryLockPath);
  if (isUv && isPoetry) {
    throw new Error(
      'Both poetry.lock and uv.lock files found. Please remove one of them.',
    );
  }

  if (isUv) {
    return new UVProvider(workspaceRoot, loggerInstance, tree);
  } else {
    return new PoetryProvider(workspaceRoot, loggerInstance, tree);
  }
};
