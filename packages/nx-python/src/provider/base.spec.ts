import { BaseProvider } from './base';
import { PoetryProvider } from './poetry';
import { Logger } from '../executors/utils/logger';
import chalk from 'chalk';
import { ExecutorContext } from '@nx/devkit';
import { MockInstance } from 'vitest';
import path from 'path';

describe('Activate Venv', () => {
  const originalEnv = process.env;
  let provider: BaseProvider;
  let installMock: MockInstance;

  beforeAll(() => {
    console.log(chalk`init chalk`);
  });

  beforeEach(() => {
    process.env = { ...originalEnv };
    provider = new PoetryProvider('.', new Logger(), undefined);
    installMock = vi.spyOn(provider, 'install').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should not activate venv when it is already activated', async () => {
    process.env.VIRTUAL_ENV = 'venv';

    await provider.activateVenv('.');

    expect(process.env).toStrictEqual({
      ...originalEnv,
      VIRTUAL_ENV: 'venv',
    });

    expect(installMock).not.toHaveBeenCalled();
  });

  it('should install venv before activating it', async () => {
    delete process.env.VIRTUAL_ENV;

    const context: ExecutorContext = {
      root: '.',
      cwd: '.',
      projectName: 'app',
      isVerbose: false,
      nxJsonConfiguration: {},
      projectGraph: {
        dependencies: {},
        nodes: {},
      },
      projectsConfigurations: {
        version: 1,
        projects: {
          app: {
            root: 'apps/app',
          },
        },
      },
    };
    await provider.activateVenv('.', true, context);

    expect(process.env).toStrictEqual({
      ...originalEnv,
      VIRTUAL_ENV: path.resolve('apps/app/.venv'),
      PATH: `${path.resolve('apps/app/.venv')}/bin:${originalEnv.PATH}`,
    });
    expect(installMock).toHaveBeenCalled();
  });

  it('should not install venv before activating it', async () => {
    delete process.env.VIRTUAL_ENV;

    const context: ExecutorContext = {
      root: '.',
      cwd: '.',
      projectName: 'app',
      isVerbose: false,
      nxJsonConfiguration: {},
      projectGraph: {
        dependencies: {},
        nodes: {},
      },
      projectsConfigurations: {
        version: 1,
        projects: {
          app: {
            root: 'apps/app',
          },
        },
      },
    };
    await provider.activateVenv('.', false, context);

    expect(process.env).toStrictEqual({
      ...originalEnv,
    });
    expect(installMock).not.toHaveBeenCalled();
  });
});
