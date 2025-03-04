import { vi, MockInstance } from 'vitest';
import { vol } from 'memfs';
import '../../utils/mocks/fs.mock';
import '../../utils/mocks/cross-spawn.mock';
import * as poetryUtils from '../../provider/poetry/utils';
import executor from './executor';
import path from 'path';
import spawn from 'cross-spawn';
import { ExecutorContext } from '@nx/devkit';
import { UVProvider } from '../../provider/uv';
import dedent from 'string-dedent';

describe('Lock Executor', () => {
  const context: ExecutorContext = {
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
    nxJsonConfiguration: {},
    projectGraph: {
      dependencies: {},
      nodes: {},
    },
  };

  afterEach(() => {
    vol.reset();
    vi.resetAllMocks();
  });

  describe('poetry', () => {
    let checkPoetryExecutableMock: MockInstance;
    let checkPoetryVersionMock: MockInstance;

    beforeEach(() => {
      checkPoetryExecutableMock = vi
        .spyOn(poetryUtils, 'checkPoetryExecutable')
        .mockResolvedValue(undefined);

      checkPoetryVersionMock = vi
        .spyOn(poetryUtils, 'getPoetryVersion')
        .mockResolvedValue('1.0.0');

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
      checkPoetryExecutableMock.mockRejectedValue(
        new Error('poetry not found'),
      );

      const options = {
        silent: false,
        debug: false,
        verbose: false,
        update: false,
      };

      const context: ExecutorContext = {
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
        nxJsonConfiguration: {},
        projectGraph: {
          dependencies: {},
          nodes: {},
        },
      };

      const output = await executor(options, context);
      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(spawn.sync).not.toHaveBeenCalled();
      expect(output.success).toBe(false);
    });

    it('should lock the poetry dependencies using default values', async () => {
      const options = {
        silent: false,
        debug: false,
        verbose: false,
        update: false,
      };

      const output = await executor(options, context);
      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(spawn.sync).toHaveBeenCalledWith(
        'poetry',
        ['lock', '--no-update'],
        {
          stdio: 'inherit',
          shell: false,
          cwd: 'apps/app',
        },
      );
      expect(output.success).toBe(true);
    });

    it('should lock the poetry dependencies with args', async () => {
      const options = {
        silent: false,
        debug: false,
        verbose: false,
        args: '--check',
        update: false,
      };

      const output = await executor(options, context);
      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(spawn.sync).toHaveBeenCalledWith(
        'poetry',
        ['lock', '--no-update', '--check'],
        {
          stdio: 'inherit',
          shell: false,
          cwd: 'apps/app',
        },
      );
      expect(output.success).toBe(true);
    });

    it('should lock the poetry dependencies with verbose flag', async () => {
      const options = {
        silent: false,
        debug: false,
        verbose: true,
        update: false,
      };

      const output = await executor(options, context);
      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(spawn.sync).toHaveBeenCalledWith(
        'poetry',
        ['lock', '--no-update', '-v'],
        {
          stdio: 'inherit',
          shell: false,
          cwd: 'apps/app',
        },
      );
      expect(output.success).toBe(true);
    });

    it('should lock the poetry dependencies with debug flag', async () => {
      const options = {
        silent: false,
        debug: true,
        verbose: false,
        update: false,
      };

      const output = await executor(options, context);
      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(spawn.sync).toHaveBeenCalledWith(
        'poetry',
        ['lock', '--no-update', '-vvv'],
        {
          stdio: 'inherit',
          shell: false,
          cwd: 'apps/app',
        },
      );
      expect(output.success).toBe(true);
    });

    it('should lock the poetry dependencies with custom cache dir', async () => {
      const options = {
        silent: false,
        debug: false,
        verbose: false,
        cacheDir: 'apps/app/.cache/pypoetry',
        update: false,
      };

      const output = await executor(options, context);
      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(spawn.sync).toHaveBeenCalledWith(
        'poetry',
        ['lock', '--no-update'],
        {
          stdio: 'inherit',
          cwd: 'apps/app',
          shell: false,
          env: {
            ...process.env,
            POETRY_CACHE_DIR: path.resolve('apps/app/.cache/pypoetry'),
          },
        },
      );
      expect(output.success).toBe(true);
    });

    it('should lock the poetry dependencies with update true (poetry v1.x)', async () => {
      const options = {
        silent: false,
        debug: false,
        verbose: false,
        update: true,
      };

      const output = await executor(options, context);
      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(spawn.sync).toHaveBeenCalledWith('poetry', ['lock'], {
        stdio: 'inherit',
        cwd: 'apps/app',
        shell: false,
      });
      expect(output.success).toBe(true);
    });

    it('should lock the poetry dependencies with update true (poetry v2.x)', async () => {
      checkPoetryVersionMock.mockResolvedValue('2.0.0');

      const options = {
        silent: false,
        debug: false,
        verbose: false,
        update: true,
      };

      const output = await executor(options, context);
      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(spawn.sync).toHaveBeenCalledWith(
        'poetry',
        ['lock', '--regenerate'],
        {
          stdio: 'inherit',
          cwd: 'apps/app',
          shell: false,
        },
      );
      expect(output.success).toBe(true);
    });

    it('should not lock when the command fail', async () => {
      vi.mocked(spawn.sync).mockImplementation(() => {
        throw new Error('fake');
      });

      const options = {
        silent: false,
        debug: false,
        verbose: false,
        cacheDir: 'apps/app/.cache/pypoetry',
        update: false,
      };

      const output = await executor(options, context);
      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(spawn.sync).toHaveBeenCalledWith(
        'poetry',
        ['lock', '--no-update'],
        {
          stdio: 'inherit',
          shell: false,
          cwd: 'apps/app',
          env: {
            ...process.env,
            POETRY_CACHE_DIR: path.resolve('apps/app/.cache/pypoetry'),
          },
        },
      );
      expect(output.success).toBe(false);
    });
  });

  describe('uv', () => {
    let checkPrerequisites: MockInstance;

    beforeEach(() => {
      vi.resetAllMocks();

      checkPrerequisites = vi
        .spyOn(UVProvider.prototype, 'checkPrerequisites')
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

    describe('worskpace', () => {
      beforeEach(() => {
        vol.fromJSON({
          'uv.lock': '',
        });
      });

      it('should return success false when the uv is not installed', async () => {
        checkPrerequisites.mockRejectedValue(new Error('uv not found'));

        const options = {
          silent: false,
          debug: false,
          verbose: false,
          update: false,
        };

        const context: ExecutorContext = {
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
          nxJsonConfiguration: {},
          projectGraph: {
            dependencies: {},
            nodes: {},
          },
        };

        const output = await executor(options, context);
        expect(checkPrerequisites).toHaveBeenCalled();
        expect(spawn.sync).not.toHaveBeenCalled();
        expect(output.success).toBe(false);
      });

      it('should lock the dependencies using default values', async () => {
        const options = {
          silent: false,
          debug: false,
          verbose: false,
          update: false,
        };

        const output = await executor(options, context);
        expect(checkPrerequisites).toHaveBeenCalled();
        expect(spawn.sync).toHaveBeenCalledWith('uv', ['lock'], {
          stdio: 'inherit',
          shell: false,
          cwd: '.',
        });
        expect(output.success).toBe(true);
      });

      it('should lock the dependencies with args', async () => {
        const options = {
          silent: false,
          debug: false,
          verbose: false,
          args: '--frozen',
          update: false,
        };

        const output = await executor(options, context);
        expect(checkPrerequisites).toHaveBeenCalled();
        expect(spawn.sync).toHaveBeenCalledWith('uv', ['lock', '--frozen'], {
          stdio: 'inherit',
          shell: false,
          cwd: '.',
        });
        expect(output.success).toBe(true);
      });

      it('should lock the dependencies with verbose flag', async () => {
        const options = {
          silent: false,
          debug: false,
          verbose: true,
          update: false,
        };

        const output = await executor(options, context);
        expect(checkPrerequisites).toHaveBeenCalled();
        expect(spawn.sync).toHaveBeenCalledWith('uv', ['lock', '-v'], {
          stdio: 'inherit',
          shell: false,
          cwd: '.',
        });
        expect(output.success).toBe(true);
      });

      it('should lock the dependencies with debug flag', async () => {
        const options = {
          silent: false,
          debug: true,
          verbose: false,
          update: false,
        };

        const output = await executor(options, context);
        expect(checkPrerequisites).toHaveBeenCalled();
        expect(spawn.sync).toHaveBeenCalledWith('uv', ['lock', '-vvv'], {
          stdio: 'inherit',
          shell: false,
          cwd: '.',
        });
        expect(output.success).toBe(true);
      });

      it('should lock the dependencies with custom cache dir', async () => {
        const options = {
          silent: false,
          debug: false,
          verbose: false,
          cacheDir: 'apps/app/.cache/custom',
          update: false,
        };

        const output = await executor(options, context);
        expect(checkPrerequisites).toHaveBeenCalled();
        expect(spawn.sync).toHaveBeenCalledWith(
          'uv',
          ['lock', '--cache-dir', 'apps/app/.cache/custom'],
          {
            stdio: 'inherit',
            cwd: '.',
            shell: false,
          },
        );
        expect(output.success).toBe(true);
      });

      it('should lock the dependencies with update true', async () => {
        const options = {
          silent: false,
          debug: false,
          verbose: false,
          update: true,
        };

        const output = await executor(options, context);
        expect(checkPrerequisites).toHaveBeenCalled();
        expect(spawn.sync).toHaveBeenCalledWith('uv', ['lock', '--upgrade'], {
          stdio: 'inherit',
          cwd: '.',
          shell: false,
        });
        expect(output.success).toBe(true);
      });

      it('should not lock when the command fail', async () => {
        vi.mocked(spawn.sync).mockImplementation(() => {
          throw new Error('fake');
        });

        const options = {
          silent: false,
          debug: false,
          verbose: false,
          update: false,
        };

        const output = await executor(options, context);
        expect(checkPrerequisites).toHaveBeenCalled();
        expect(spawn.sync).toHaveBeenCalledWith('uv', ['lock'], {
          stdio: 'inherit',
          shell: false,
          cwd: '.',
        });
        expect(output.success).toBe(false);
      });
    });

    describe('project', () => {
      beforeEach(() => {
        vol.fromJSON({
          'apps/app/pyproject.toml': dedent`
          [project]
          name = "app"
          version = "0.1.0"
          readme = "README.md"
          requires-python = ">=3.12"
          dependencies = []
          `,
        });
      });

      it('should lock the dependencies using default values', async () => {
        const options = {
          silent: false,
          debug: false,
          verbose: false,
          update: false,
        };

        const output = await executor(options, context);
        expect(checkPrerequisites).toHaveBeenCalled();
        expect(spawn.sync).toHaveBeenCalledWith('uv', ['lock'], {
          stdio: 'inherit',
          shell: false,
          cwd: 'apps/app',
        });
        expect(output.success).toBe(true);
      });
    });
  });
});
