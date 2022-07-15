import { spawnSyncMock } from '../../utils/mocks/cross-spawn.mock';
import executor from './executor';
import path from 'path'

describe('Install Executor', () => {
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

  it('should install the poetry dependencies using default values', async () => {
    const options = {
      silent: false,
      debug: false,
      verbose: false
    }

    const output = await executor(options, context);
    expect(spawnSyncMock).toHaveBeenCalledWith(
      'poetry', ['install', '-v'], {
      stdio: 'inherit',
      shell: false,
      cwd: 'apps/app'
    })
    expect(output.success).toBe(true);
  });

  it('should install the poetry dependencies with args', async () => {
    const options = {
      silent: false,
      debug: false,
      verbose: false,
      args: '--no-dev'
    }

    const output = await executor(options, context);
    expect(spawnSyncMock).toHaveBeenCalledWith(
      'poetry', ['install', '-v', '--no-dev'], {
      stdio: 'inherit',
      shell: false,
      cwd: 'apps/app'
    })
    expect(output.success).toBe(true);
  });

  it('should install the poetry dependencies with verbose flag', async () => {
    const options = {
      silent: false,
      debug: false,
      verbose: true
    }

    const output = await executor(options, context);
    expect(spawnSyncMock).toHaveBeenCalledWith(
      'poetry', ['install', '-vv'], {
      stdio: 'inherit',
      shell: false,
      cwd: 'apps/app'
    })
    expect(output.success).toBe(true);
  });

  it('should install the poetry dependencies with debug flag', async () => {
    const options = {
      silent: false,
      debug: true,
      verbose: false
    }

    const output = await executor(options, context);
    expect(spawnSyncMock).toHaveBeenCalledWith(
      'poetry', ['install','-vv'], {
      stdio: 'inherit',
      shell: false,
      cwd: 'apps/app'
    })
    expect(output.success).toBe(true);
  });

  it('should install the poetry dependencies with custom cache dir', async () => {
    const options = {
      silent: false,
      debug: false,
      verbose: false,
      cacheDir: 'apps/app/.cache/pypoetry'
    }

    const output = await executor(options, context);
    expect(spawnSyncMock).toHaveBeenCalledWith(
      'poetry', ['install', '-v'], {
      stdio: 'inherit',
      cwd: 'apps/app',
      shell: false,
      env: {
        ...process.env,
        POETRY_CACHE_DIR: path.resolve('apps/app/.cache/pypoetry')
      }
    })
    expect(output.success).toBe(true);
  });

  it('should not install when the command fail', async () => {
    spawnSyncMock.mockImplementation(() => {
      throw new Error('fake')
    })

    const options = {
      silent: false,
      debug: false,
      verbose: false,
      cacheDir: 'apps/app/.cache/pypoetry'
    }

    const output = await executor(options, context);
    expect(spawnSyncMock).toHaveBeenCalledWith(
      'poetry', ['install', '-v'], {
      stdio: 'inherit',
      shell: false,
      cwd: 'apps/app'
    })
    expect(output.success).toBe(false);
  });
});
