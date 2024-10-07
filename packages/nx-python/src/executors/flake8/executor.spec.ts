import { vi, MockInstance } from 'vitest';
import { vol } from 'memfs';
import chalk from 'chalk';
import '../../utils/mocks/fs.mock';
import '../../utils/mocks/cross-spawn.mock';
import * as poetryUtils from '../utils/poetry';
import executor from './executor';
import { tmpdir } from 'os';
import { join } from 'path';
import { v4 as uuid } from 'uuid';
import { mkdirsSync, writeFileSync } from 'fs-extra';
import spawn from 'cross-spawn';

describe('Flake8 Executor', () => {
  let tmppath = null;
  let checkPoetryExecutableMock: MockInstance;
  let activateVenvMock: MockInstance;

  beforeEach(() => {
    tmppath = join(tmpdir(), 'nx-python', 'flake8', uuid());
    checkPoetryExecutableMock = vi
      .spyOn(poetryUtils, 'checkPoetryExecutable')
      .mockResolvedValue(undefined);

    activateVenvMock = vi
      .spyOn(poetryUtils, 'activateVenv')
      .mockReturnValue(undefined);

    vi.mocked(spawn.sync).mockReturnValue({
      status: 0,
      output: [''],
      pid: 0,
      signal: null,
      stderr: null,
      stdout: null,
    });

    vi.spyOn(process, 'chdir').mockReturnValue(undefined);
  });

  beforeAll(() => {
    console.log(chalk`init chalk`);
  });

  afterEach(() => {
    vol.reset();
    vi.resetAllMocks();
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
      projectsConfigurations: {
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
    expect(spawn.sync).not.toHaveBeenCalled();
    expect(output.success).toBe(false);
  });

  it('should execute flake8 linting', async () => {
    const outputFile = join(tmppath, 'reports/apps/app/pylint.txt');
    vi.mocked(spawn.sync).mockImplementation(() => {
      writeFileSync(outputFile, '', { encoding: 'utf8' });
      return {
        status: 0,
        output: [''],
        pid: 0,
        signal: null,
        stderr: null,
        stdout: null,
      };
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
        projectsConfigurations: {
          version: 2,

          projects: {
            app: {
              root: 'apps/app',
              targets: {},
            },
          },
        },
      },
    );
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    expect(activateVenvMock).toHaveBeenCalledWith('.');
    expect(spawn.sync).toHaveBeenCalledTimes(1);
    expect(output.success).toBe(true);
  });

  it('should execute flake8 linting when the reports folder already exists', async () => {
    mkdirsSync(join(tmppath, 'reports/apps/app'));
    const outputFile = join(tmppath, 'reports/apps/app/pylint.vi.mocked(txt');
    vi.mocked(spawn.sync).mockImplementation(() => {
      writeFileSync(outputFile, '', { encoding: 'utf8' });

      return {
        status: 0,
        output: [''],
        pid: 0,
        signal: null,
        stderr: null,
        stdout: null,
      };
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
        projectsConfigurations: {
          version: 2,

          projects: {
            app: {
              root: 'apps/app',
              targets: {},
            },
          },
        },
      },
    );
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    expect(activateVenvMock).toHaveBeenCalledWith('.');
    expect(spawn.sync).toHaveBeenCalledTimes(1);
    expect(output.success).toBe(true);
  });

  it('should returns a error when run the flake8 CLI', async () => {
    vi.mocked(spawn.sync).mockImplementation(() => {
      throw new Error('Some error');
    });

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
        projectsConfigurations: {
          version: 2,

          projects: {
            app: {
              root: 'apps/app',
              targets: {},
            },
          },
        },
      },
    );
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    expect(activateVenvMock).toHaveBeenCalledWith('.');
    expect(spawn.sync).toHaveBeenCalledTimes(1);
    expect(output.success).toBe(false);
  });

  it('should execute flake8 linting with pylint content more than 1 line', async () => {
    mkdirsSync(join(tmppath, 'reports/apps/app'));
    const outputFile = join(tmppath, 'reports/apps/app/pylint.txt');
    vi.mocked(spawn.sync).mockImplementation(() => {
      writeFileSync(outputFile, 'test\n', { encoding: 'utf8' });
      return {
        status: 0,
        output: [''],
        pid: 0,
        signal: null,
        stderr: null,
        stdout: null,
      };
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
        projectsConfigurations: {
          version: 2,

          projects: {
            app: {
              root: 'apps/app',
              targets: {},
            },
          },
        },
      },
    );
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    expect(activateVenvMock).toHaveBeenCalledWith('.');
    expect(spawn.sync).toHaveBeenCalledTimes(1);
    expect(output.success).toBe(false);
  });
});
