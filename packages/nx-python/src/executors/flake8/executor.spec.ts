import chalk from 'chalk';
import { spawnSyncMock } from '../../utils/mocks/cross-spawn.mock';
import * as poetryUtils from '../utils/poetry'
import fsMock from 'mock-fs';
import executor from './executor';
import { tmpdir } from 'os';
import { join } from 'path';
import { v4 as uuid } from "uuid";
import {
  mkdirsSync,
  writeFileSync
} from 'fs-extra';

describe('Flake8 Executor', () => {

  let tmppath = null
  let checkPoetryExecutableMock: jest.SpyInstance;

  beforeEach(() => {
    tmppath = join(tmpdir(), 'nx-python', 'flake8', uuid())
    checkPoetryExecutableMock = jest.spyOn(poetryUtils, 'checkPoetryExecutable')
    checkPoetryExecutableMock.mockResolvedValue(undefined);
  })

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
      outputFile: '',
      silent: false,
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
    expect(spawnSyncMock).not.toHaveBeenCalled();
    expect(output.success).toBe(false);
  });

  it('should execute flake8 linting', async () => {
    const outputFile = join(tmppath, 'reports/apps/app/pylint.txt')
    spawnSyncMock.mockImplementation(() => {
      writeFileSync(outputFile, '', { encoding: 'utf8' })
    });

    const output = await executor(
      {
        outputFile,
        silent: false,
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
    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    expect(output.success).toBe(true);
  });


  it('should execute flake8 linting when the reports folder already exists', async () => {
    mkdirsSync(join(tmppath, 'reports/apps/app'))
    const outputFile = join(tmppath, 'reports/apps/app/pylint.txt')
    spawnSyncMock.mockImplementation(() => {
      writeFileSync(outputFile, '', { encoding: 'utf8' })
    });

    const output = await executor(
      {
        outputFile,
        silent: false,
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
    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    expect(output.success).toBe(true);
  });

  it('should returns a error when run the flake8 CLI', async () => {
    spawnSyncMock.mockImplementation(() => {
      throw new Error('Some error')
    })

    const output = await executor(
      {
        outputFile: join(tmppath, 'reports/apps/app/pylint.txt'),
        silent: false,
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
    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    expect(output.success).toBe(false);
  });

  it('should execute flake8 linting with pylint content more than 1 line', async () => {
    mkdirsSync(join(tmppath, 'reports/apps/app'))
    const outputFile = join(tmppath, 'reports/apps/app/pylint.txt')
    writeFileSync(outputFile, '', { encoding: 'utf8' })

    spawnSyncMock.mockImplementation(() => {
      writeFileSync(outputFile, 'test\n', { encoding: 'utf8' })
    });

    const output = await executor(
      {
        outputFile,
        silent: false,
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
    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    expect(output.success).toBe(false);
  });
});
