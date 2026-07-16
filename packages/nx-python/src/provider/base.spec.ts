import { BaseProvider } from './base';
import { PoetryProvider } from './poetry';
import { PoetryPyprojectToml } from './poetry/types';
import { Logger } from '../executors/utils/logger';
import * as utils from './utils';
import chalk from 'chalk';
import { ExecutorContext, Tree } from '@nx/devkit';
import { MockInstance } from 'vitest';
import path from 'path';

describe('Activate Venv', () => {
  const originalEnv = process.env;
  let provider: BaseProvider<PoetryPyprojectToml>;
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

describe('getPyprojectToml', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('preserves the drive letter when reading an absolute Windows path from the filesystem', () => {
    const getPyprojectDataSpy = vi
      .spyOn(utils, 'getPyprojectData')
      .mockReturnValue({} as PoetryPyprojectToml);

    // Without a `tree`, `projectRoot` may be an absolute OS path — e.g. the
    // temporary build folder returned by `os.tmpdir()` in an executor. On
    // Windows `joinPathFragments` would strip the drive letter, so the file
    // would not be found and the pyproject would parse as empty.
    const provider = new PoetryProvider('.', new Logger());
    const projectRoot =
      'C:\\Users\\me\\AppData\\Local\\Temp\\nx-python\\build\\abc';

    provider.getPyprojectToml(projectRoot);

    expect(getPyprojectDataSpy).toHaveBeenCalledWith(
      path.join(projectRoot, 'pyproject.toml'),
    );
    expect(getPyprojectDataSpy.mock.calls[0][0].startsWith('C:')).toBe(true);
  });

  it('reads workspace-relative POSIX paths from the tree', () => {
    const readPyprojectTomlSpy = vi
      .spyOn(utils, 'readPyprojectToml')
      .mockReturnValue({} as PoetryPyprojectToml);
    const tree = {
      exists: () => false,
      read: () => null,
    } as unknown as Tree;

    const provider = new PoetryProvider('apps/app', new Logger(), tree);

    provider.getPyprojectToml('apps/app');

    expect(readPyprojectTomlSpy).toHaveBeenCalledWith(
      tree,
      'apps/app/pyproject.toml',
    );
  });
});
