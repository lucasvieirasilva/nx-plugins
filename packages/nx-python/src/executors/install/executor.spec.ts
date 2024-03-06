import { vi, MockInstance } from 'vitest';
import '../../utils/mocks/cross-spawn.mock';
import * as poetryUtils from '../utils/poetry';
import executor from './executor';
import path from 'path';
import spawn from 'cross-spawn';

describe('Install Executor', () => {
  let checkPoetryExecutableMock: MockInstance;

  const context = {
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
  };

  beforeEach(() => {
    checkPoetryExecutableMock = vi
      .spyOn(poetryUtils, 'checkPoetryExecutable')
      .mockResolvedValue(undefined);

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

  it('should return success false when the poetry is not installed', async () => {
    checkPoetryExecutableMock.mockRejectedValue(new Error('poetry not found'));

    const options = {
      silent: false,
      debug: false,
      verbose: false,
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
    expect(spawn.sync).not.toHaveBeenCalled();
    expect(output.success).toBe(false);
  });

  it('should install the poetry dependencies using default values', async () => {
    const options = {
      silent: false,
      debug: false,
      verbose: false,
    };

    const output = await executor(options, context);
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    expect(spawn.sync).toHaveBeenCalledWith('poetry', ['install', '-v'], {
      stdio: 'inherit',
      shell: false,
      cwd: 'apps/app',
    });
    expect(output.success).toBe(true);
  });

  it('should install the poetry dependencies with args', async () => {
    const options = {
      silent: false,
      debug: false,
      verbose: false,
      args: '--no-dev',
    };

    const output = await executor(options, context);
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    expect(spawn.sync).toHaveBeenCalledWith(
      'poetry',
      ['install', '-v', '--no-dev'],
      {
        stdio: 'inherit',
        shell: false,
        cwd: 'apps/app',
      },
    );
    expect(output.success).toBe(true);
  });

  it('should install the poetry dependencies with verbose flag', async () => {
    const options = {
      silent: false,
      debug: false,
      verbose: true,
    };

    const output = await executor(options, context);
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    expect(spawn.sync).toHaveBeenCalledWith('poetry', ['install', '-vv'], {
      stdio: 'inherit',
      shell: false,
      cwd: 'apps/app',
    });
    expect(output.success).toBe(true);
  });

  it('should install the poetry dependencies with debug flag', async () => {
    const options = {
      silent: false,
      debug: true,
      verbose: false,
    };

    const output = await executor(options, context);
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    expect(spawn.sync).toHaveBeenCalledWith('poetry', ['install', '-vv'], {
      stdio: 'inherit',
      shell: false,
      cwd: 'apps/app',
    });
    expect(output.success).toBe(true);
  });

  it('should install the poetry dependencies with custom cache dir', async () => {
    const options = {
      silent: false,
      debug: false,
      verbose: false,
      cacheDir: 'apps/app/.cache/pypoetry',
    };

    const output = await executor(options, context);
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    expect(spawn.sync).toHaveBeenCalledWith('poetry', ['install', '-v'], {
      stdio: 'inherit',
      cwd: 'apps/app',
      shell: false,
      env: {
        ...process.env,
        POETRY_CACHE_DIR: path.resolve('apps/app/.cache/pypoetry'),
      },
    });
    expect(output.success).toBe(true);
  });

  it('should not install when the command fail', async () => {
    vi.mocked(spawn.sync).mockImplementation(() => {
      throw new Error('fake');
    });

    const options = {
      silent: false,
      debug: false,
      verbose: false,
      cacheDir: 'apps/app/.cache/pypoetry',
    };

    const output = await executor(options, context);
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    expect(spawn.sync).toHaveBeenCalledWith('poetry', ['install', '-v'], {
      stdio: 'inherit',
      shell: false,
      cwd: 'apps/app',
    });
    expect(output.success).toBe(false);
  });
});
