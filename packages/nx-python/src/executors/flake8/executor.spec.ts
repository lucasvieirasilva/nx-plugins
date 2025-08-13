import { vi, MockInstance } from 'vitest';
import { vol } from 'memfs';
import chalk from 'chalk';
import '../../utils/mocks/fs.mock';
import '../../utils/mocks/cross-spawn.mock';
import * as poetryUtils from '../../provider/poetry/utils';
import executor from './executor';
import { tmpdir } from 'os';
import { join } from 'path';
import { v4 as uuid } from 'uuid';
import { mkdirsSync, writeFileSync } from 'fs-extra';
import spawn from 'cross-spawn';
import { ExecutorContext } from '@nx/devkit';
import { UVProvider } from '../../provider/uv';
import { PoetryProvider } from '../../provider/poetry/provider';

describe('Flake8 Executor', () => {
  let tmppath = null;

  beforeAll(() => {
    console.log(chalk`init chalk`);
  });

  afterEach(() => {
    vol.reset();
    vi.resetAllMocks();
  });

  describe('poetry', () => {
    let checkPoetryExecutableMock: MockInstance;
    let activateVenvMock: MockInstance;

    beforeEach(() => {
      tmppath = join(tmpdir(), 'nx-python', 'flake8', uuid());
      checkPoetryExecutableMock = vi
        .spyOn(poetryUtils, 'checkPoetryExecutable')
        .mockResolvedValue(undefined);

      activateVenvMock = vi
        .spyOn(PoetryProvider.prototype, 'activateVenv')
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
      checkPoetryExecutableMock.mockRejectedValue(
        new Error('poetry not found'),
      );

      const options = {
        outputFile: '',
        silent: false,
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
      expect(activateVenvMock).toHaveBeenCalledWith('.', false, context);
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

      const output = await executor(
        {
          outputFile,
          silent: false,
        },
        context,
      );
      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.', false, context);
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

      const output = await executor(
        {
          outputFile,
          silent: false,
        },
        context,
      );
      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.', false, context);
      expect(spawn.sync).toHaveBeenCalledTimes(1);
      expect(output.success).toBe(true);
    });

    it('should returns a error when run the flake8 CLI', async () => {
      vi.mocked(spawn.sync).mockImplementation(() => {
        throw new Error('Some error');
      });

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

      const output = await executor(
        {
          outputFile: join(tmppath, 'reports/apps/app/pylint.txt'),
          silent: false,
        },
        context,
      );
      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.', false, context);
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

      const output = await executor(
        {
          outputFile,
          silent: false,
        },
        context,
      );
      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.', false, context);
      expect(spawn.sync).toHaveBeenCalledTimes(1);
      expect(output.success).toBe(false);
    });
  });

  describe('uv', () => {
    let checkPrerequisites: MockInstance;
    let activateVenvMock: MockInstance;

    beforeEach(() => {
      tmppath = join(tmpdir(), 'nx-python', 'flake8', uuid());

      checkPrerequisites = vi
        .spyOn(UVProvider.prototype, 'checkPrerequisites')
        .mockResolvedValue(undefined);

      activateVenvMock = vi
        .spyOn(UVProvider.prototype, 'activateVenv')
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

    beforeEach(() => {
      vol.fromJSON({
        'uv.lock': '',
      });
    });

    it('should return success false when the uv is not installed', async () => {
      checkPrerequisites.mockRejectedValue(new Error('uv not found'));

      const options = {
        outputFile: 'reports',
        silent: false,
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
      expect(activateVenvMock).toHaveBeenCalledWith('.', false, context);
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

      const output = await executor(
        {
          outputFile,
          silent: false,
        },
        context,
      );
      expect(checkPrerequisites).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.', false, context);
      expect(spawn.sync).toHaveBeenCalledTimes(1);
      expect(spawn.sync).toHaveBeenCalledWith(
        'uv',
        ['run', 'flake8', '--output-file', outputFile],
        {
          cwd: 'apps/app',
          shell: false,
          stdio: 'inherit',
        },
      );
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

      const output = await executor(
        {
          outputFile,
          silent: false,
        },
        context,
      );
      expect(checkPrerequisites).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.', false, context);
      expect(spawn.sync).toHaveBeenCalledTimes(1);
      expect(spawn.sync).toHaveBeenCalledWith(
        'uv',
        ['run', 'flake8', '--output-file', outputFile],
        {
          cwd: 'apps/app',
          shell: false,
          stdio: 'inherit',
        },
      );
      expect(output.success).toBe(true);
    });

    it('should returns a error when run the flake8 CLI', async () => {
      vi.mocked(spawn.sync).mockImplementation(() => {
        throw new Error('Some error');
      });

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

      const outputFile = join(tmppath, 'reports/apps/app/pylint.txt');
      const output = await executor(
        {
          outputFile,
          silent: false,
        },
        context,
      );
      expect(checkPrerequisites).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.', false, context);
      expect(spawn.sync).toHaveBeenCalledTimes(1);
      expect(spawn.sync).toHaveBeenCalledWith(
        'uv',
        ['run', 'flake8', '--output-file', outputFile],
        {
          cwd: 'apps/app',
          shell: false,
          stdio: 'inherit',
        },
      );
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
          nxJsonConfiguration: {},
          projectGraph: {
            dependencies: {},
            nodes: {},
          },
        },
      );
      expect(checkPrerequisites).toHaveBeenCalled();
      expect(spawn.sync).toHaveBeenCalledTimes(1);
      expect(spawn.sync).toHaveBeenCalledWith(
        'uv',
        ['run', 'flake8', '--output-file', outputFile],
        {
          cwd: 'apps/app',
          shell: false,
          stdio: 'inherit',
        },
      );
      expect(output.success).toBe(false);
    });
  });
});
