import { execSyncMock } from '../../utils/mocks/child_process.mock';
import executor from './executor';
import path from 'path'

describe('Install Executor', () => {
  const context = {
    cwd: '',
    root: '',
    isVerbose: false,
    projectName: 'app',
    workspace: {
      version: 2,
      npmScope: '@lucasvieira',
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
    expect(execSyncMock).toHaveBeenCalledWith(
      'poetry install -v ', {
      stdio: 'inherit',
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
    expect(execSyncMock).toHaveBeenCalledWith(
      'poetry install -v --no-dev', {
      stdio: 'inherit',
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
    expect(execSyncMock).toHaveBeenCalledWith(
      'poetry install -vv ', {
      stdio: 'inherit',
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
    expect(execSyncMock).toHaveBeenCalledWith(
      'poetry install -vv ', {
      stdio: 'inherit',
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
    expect(execSyncMock).toHaveBeenCalledWith(
      'poetry install -v ', {
      stdio: 'inherit',
      cwd: 'apps/app',
      env: {
        ...process.env,
        POETRY_CACHE_DIR: path.resolve('apps/app/.cache/pypoetry')
      }
    })
    expect(output.success).toBe(true);
  });

  it('should not install when the command fail', async () => {
    execSyncMock.mockImplementation(() => {
      throw new Error('fake')
    })

    const options = {
      silent: false,
      debug: false,
      verbose: false,
      cacheDir: 'apps/app/.cache/pypoetry'
    }

    const output = await executor(options, context);
    expect(execSyncMock).toHaveBeenCalledWith(
      'poetry install -v ', {
      stdio: 'inherit',
      cwd: 'apps/app'
    })
    expect(output.success).toBe(false);
  });
});
