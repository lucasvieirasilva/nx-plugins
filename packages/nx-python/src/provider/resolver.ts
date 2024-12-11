import fs from 'fs';
import path from 'path';
import { IProvider } from './base';
import { UVProvider } from './uv';
import { PoetryProvider } from './poetry';
import { Logger } from '../executors/utils/logger';

export const getProvider = async (
  workspaceCwd: string,
  logger?: Logger,
): Promise<IProvider> => {
  const loggerInstance = logger ?? new Logger();

  const isUv = fs.existsSync(path.join(workspaceCwd, 'uv.lock'));
  if (isUv) {
    return new UVProvider(loggerInstance);
  }

  return new PoetryProvider(loggerInstance);
};
