import { spawnSyncMock } from '../../utils/mocks/cross-spawn.mock';
import * as poetryUtils from '../utils/poetry';

const buildExecutorMock = jest.fn();

jest.mock('../build/executor', () => {
  return buildExecutorMock;
});

import { ToxExecutorSchema } from './schema';
import executor from './executor';
import fsMock from 'mock-fs';
import chalk from 'chalk';

const options: ToxExecutorSchema = {
  silent: false,
};

describe('Tox Executor', () => {
  let checkPoetryExecutableMock: jest.SpyInstance;

  const context = {
    cwd: '.',
    root: '.',
    isVerbose: false,
    projectName: 'app',
    workspace: {
      version: 2,
      npmScope: 'nxlv',
      projects: {
        app: {
          root: 'apps/app',
          targets: {},
        },
      },
    },
  };

  beforeAll(() => {
    console.log(chalk`init chalk`);
  });

  beforeEach(() => {
    checkPoetryExecutableMock = jest.spyOn(
      poetryUtils,
      'checkPoetryExecutable'
    );
    checkPoetryExecutableMock.mockResolvedValue(undefined);
    spawnSyncMock.mockReturnValue({ status: 0 });
  });

  afterEach(() => {
    fsMock.restore();
    jest.resetAllMocks();
  });

  it('should return success false when the poetry is not installed', async () => {
    checkPoetryExecutableMock.mockRejectedValue(new Error('poetry not found'));

    const context = {
      cwd: '',
      root: '.',
      isVerbose: false,
      projectName: 'app',
      workspace: {
        npmScope: 'nxlv',
        version: 2,
        projects: {
          app: {
            root: 'apps/app',
            targets: {},
          },
        },
      },
    };

    const output = await executor(options, context);
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    expect(buildExecutorMock).not.toHaveBeenCalled();
    expect(spawnSyncMock).not.toHaveBeenCalled();
    expect(output.success).toBe(false);
  });

  it('should build and run tox successfully', async () => {
    buildExecutorMock.mockResolvedValue({
      success: true,
    });

    fsMock({
      'apps/app/dist/package.tar.gz': 'fake',
    });

    const output = await executor(options, context);
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    expect(buildExecutorMock).toBeCalledWith(
      {
        silent: options.silent,
        keepBuildFolder: false,
        ignorePaths: ['.venv', '.tox', 'tests'],
        outputPath: 'apps/app/dist',
        devDependencies: true,
        lockedVersions: true,
        bundleLocalDependencies: true,
      },
      context
    );
    expect(spawnSyncMock).toBeCalledWith(
      'poetry',
      ['run', 'tox', '--installpkg', 'dist/package.tar.gz'],
      {
        cwd: 'apps/app',
        shell: false,
        stdio: 'inherit',
      }
    );
    expect(output.success).toBe(true);
  });

  it('should build and run tox successfully with args', async () => {
    buildExecutorMock.mockResolvedValue({
      success: true,
    });

    fsMock({
      'apps/app/dist/package.tar.gz': 'fake',
    });

    const output = await executor(
      {
        silent: false,
        args: '-e linters',
      },
      context
    );

    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    expect(buildExecutorMock).toBeCalledWith(
      {
        silent: options.silent,
        keepBuildFolder: false,
        ignorePaths: ['.venv', '.tox', 'tests'],
        outputPath: 'apps/app/dist',
        devDependencies: true,
        lockedVersions: true,
        bundleLocalDependencies: true,
      },
      context
    );
    expect(spawnSyncMock).toBeCalledWith(
      'poetry',
      ['run', 'tox', '--installpkg', 'dist/package.tar.gz', '-e', 'linters'],
      {
        cwd: 'apps/app',
        shell: false,
        stdio: 'inherit',
      }
    );
    expect(output.success).toBe(true);
  });

  it('should failure the build and not run tox command', async () => {
    buildExecutorMock.mockResolvedValue({
      success: false,
    });

    const output = await executor(options, context);
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    expect(buildExecutorMock).toBeCalledWith(
      {
        silent: options.silent,
        keepBuildFolder: false,
        ignorePaths: ['.venv', '.tox', 'tests'],
        outputPath: 'apps/app/dist',
        devDependencies: true,
        lockedVersions: true,
        bundleLocalDependencies: true,
      },
      context
    );
    expect(spawnSyncMock).not.toBeCalled();
    expect(output.success).toBe(false);
  });

  it('should dist folder not exists and not run tox command', async () => {
    buildExecutorMock.mockResolvedValue({
      success: true,
    });

    const output = await executor(options, context);
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    expect(buildExecutorMock).toBeCalledWith(
      {
        silent: options.silent,
        keepBuildFolder: false,
        ignorePaths: ['.venv', '.tox', 'tests'],
        outputPath: 'apps/app/dist',
        devDependencies: true,
        lockedVersions: true,
        bundleLocalDependencies: true,
      },
      context
    );
    expect(spawnSyncMock).not.toBeCalled();
    expect(output.success).toBe(false);
  });

  it('should not generate the tar.gz and not run tox command', async () => {
    fsMock({
      'apps/app/dist/something.txt': 'fake',
    });

    buildExecutorMock.mockResolvedValue({
      success: true,
    });

    const output = await executor(options, context);
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    expect(buildExecutorMock).toBeCalledWith(
      {
        silent: options.silent,
        keepBuildFolder: false,
        ignorePaths: ['.venv', '.tox', 'tests'],
        outputPath: 'apps/app/dist',
        devDependencies: true,
        lockedVersions: true,
        bundleLocalDependencies: true,
      },
      context
    );
    expect(spawnSyncMock).not.toBeCalled();
    expect(output.success).toBe(false);
  });
});
