import chalk from 'chalk';
import { spawnSyncMock } from '../../utils/mocks/cross-spawn.mock';
import * as poetryUtils from '../utils/poetry';
import fsMock from 'mock-fs';
import executor from './executor';

describe('Ruff Check Executor', () => {
  let checkPoetryExecutableMock: jest.SpyInstance;
  let activateVenvMock: jest.SpyInstance;

  beforeEach(() => {
    checkPoetryExecutableMock = jest
      .spyOn(poetryUtils, 'checkPoetryExecutable')
      .mockResolvedValue(undefined);

    activateVenvMock = jest
      .spyOn(poetryUtils, 'activateVenv')
      .mockReturnValue(undefined);

    spawnSyncMock.mockReturnValue({ status: 0 });
  });

  beforeAll(() => {
    console.log(chalk`init chalk`);
  });

  afterEach(() => {
    fsMock.restore();
    jest.resetAllMocks();
  });

  it('should return success false when the poetry is not installed', async () => {
    checkPoetryExecutableMock.mockRejectedValue(new Error('poetry not found'));

    const options = {
      lintFilePatterns: ['app'],
      __unparsed__: [],
    };

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
    expect(activateVenvMock).toHaveBeenCalledWith('.');
    expect(spawnSyncMock).not.toHaveBeenCalled();
    expect(output.success).toBe(false);
  });

  it('should execute ruff check linting', async () => {
    spawnSyncMock.mockReturnValueOnce({ status: 0 });

    const output = await executor(
      {
        lintFilePatterns: ['app'],
        __unparsed__: [],
      },
      {
        cwd: '',
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
      }
    );
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    expect(activateVenvMock).toHaveBeenCalledWith('.');
    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    expect(spawnSyncMock).toHaveBeenCalledWith('poetry run ruff check app', {
      cwd: 'apps/app',
      shell: true,
      stdio: 'inherit',
    });
    expect(output.success).toBe(true);
  });

  it('should fail to execute ruff check linting ', async () => {
    spawnSyncMock.mockReturnValueOnce({ status: 1 });

    const output = await executor(
      {
        lintFilePatterns: ['app'],
        __unparsed__: [],
      },
      {
        cwd: '',
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
      }
    );
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    expect(activateVenvMock).toHaveBeenCalledWith('.');
    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    expect(spawnSyncMock).toHaveBeenCalledWith('poetry run ruff check app', {
      cwd: 'apps/app',
      shell: true,
      stdio: 'inherit',
    });
    expect(output.success).toBe(false);
  });
});
