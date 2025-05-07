import { vi, MockInstance } from 'vitest';
import { vol } from 'memfs';
import chalk from 'chalk';
import '../../utils/mocks/fs.mock';
import '../../utils/mocks/cross-spawn.mock';
import * as poetryUtils from '../../provider/poetry/utils';
import executor from './executor';
import spawn from 'cross-spawn';
import { ExecutorContext } from '@nx/devkit';
import { UVProvider } from '../../provider/uv';
import { PoetryProvider } from '../../provider/poetry/provider';

describe('Ruff Format Executor', () => {
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
        filePatterns: ['app'],
        check: false,
        __unparsed__: [],
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
      expect(activateVenvMock).toHaveBeenCalledWith('.', context);
      expect(spawn.sync).not.toHaveBeenCalled();
      expect(output.success).toBe(false);
    });

    it('should execute ruff format', async () => {
      vi.mocked(spawn.sync).mockReturnValueOnce({
        status: 0,
        output: [''],
        pid: 0,
        signal: null,
        stderr: null,
        stdout: null,
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
          filePatterns: ['app'],
          check: false,
          __unparsed__: [],
        },
        context,
      );
      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.', context);
      expect(spawn.sync).toHaveBeenCalledTimes(1);
      expect(spawn.sync).toHaveBeenCalledWith(
        'poetry',
        ['run', 'ruff', 'format', 'app'],
        {
          cwd: 'apps/app',
          shell: true,
          stdio: 'inherit',
        },
      );
      expect(output.success).toBe(true);
    });

    it('should execute ruff format with check', async () => {
      vi.mocked(spawn.sync).mockReturnValueOnce({
        status: 0,
        output: [''],
        pid: 0,
        signal: null,
        stderr: null,
        stdout: null,
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
          filePatterns: ['app'],
          check: true,
          __unparsed__: [],
        },
        context,
      );
      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.', context);
      expect(spawn.sync).toHaveBeenCalledTimes(1);
      expect(spawn.sync).toHaveBeenCalledWith(
        'poetry',
        ['run', 'ruff', 'format', 'app', '--check'],
        {
          cwd: 'apps/app',
          shell: true,
          stdio: 'inherit',
        },
      );
      expect(output.success).toBe(true);
    });

    it('should fail to execute ruff format ', async () => {
      vi.mocked(spawn.sync).mockReturnValueOnce({
        status: 1,
        output: [''],
        pid: 0,
        signal: null,
        stderr: null,
        stdout: null,
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
          filePatterns: ['app'],
          check: false,
          __unparsed__: [],
        },
        context,
      );
      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.', context);
      expect(spawn.sync).toHaveBeenCalledTimes(1);
      expect(spawn.sync).toHaveBeenCalledWith(
        'poetry',
        ['run', 'ruff', 'format', 'app'],
        {
          cwd: 'apps/app',
          shell: true,
          stdio: 'inherit',
        },
      );
      expect(output.success).toBe(false);
    });
  });

  describe('uv', () => {
    let checkPrerequisites: MockInstance;
    let activateVenvMock: MockInstance;

    beforeEach(() => {
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
        filePatterns: ['app'],
        check: false,
        __unparsed__: [],
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
      expect(activateVenvMock).toHaveBeenCalledWith('.', context);
      expect(spawn.sync).not.toHaveBeenCalled();
      expect(output.success).toBe(false);
    });

    it('should execute ruff format', async () => {
      vi.mocked(spawn.sync).mockReturnValueOnce({
        status: 0,
        output: [''],
        pid: 0,
        signal: null,
        stderr: null,
        stdout: null,
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
          filePatterns: ['app'],
          check: false,
          __unparsed__: [],
        },
        context,
      );
      expect(checkPrerequisites).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.', context);
      expect(spawn.sync).toHaveBeenCalledTimes(1);
      expect(spawn.sync).toHaveBeenCalledWith(
        'uv',
        ['run', 'ruff', 'format', 'app'],
        {
          cwd: 'apps/app',
          shell: true,
          stdio: 'inherit',
        },
      );
      expect(output.success).toBe(true);
    });

    it('should execute ruff format with check', async () => {
      vi.mocked(spawn.sync).mockReturnValueOnce({
        status: 0,
        output: [''],
        pid: 0,
        signal: null,
        stderr: null,
        stdout: null,
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
          filePatterns: ['app'],
          check: true,
          __unparsed__: [],
        },
        context,
      );
      expect(checkPrerequisites).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.', context);
      expect(spawn.sync).toHaveBeenCalledTimes(1);
      expect(spawn.sync).toHaveBeenCalledWith(
        'uv',
        ['run', 'ruff', 'format', 'app', '--check'],
        {
          cwd: 'apps/app',
          shell: true,
          stdio: 'inherit',
        },
      );
      expect(output.success).toBe(true);
    });

    it('should fail to execute ruff format ', async () => {
      vi.mocked(spawn.sync).mockReturnValueOnce({
        status: 1,
        output: [''],
        pid: 0,
        signal: null,
        stderr: null,
        stdout: null,
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
          filePatterns: ['app'],
          check: false,
          __unparsed__: [],
        },
        context,
      );
      expect(checkPrerequisites).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.', context);
      expect(spawn.sync).toHaveBeenCalledTimes(1);
      expect(spawn.sync).toHaveBeenCalledWith(
        'uv',
        ['run', 'ruff', 'format', 'app'],
        {
          cwd: 'apps/app',
          shell: true,
          stdio: 'inherit',
        },
      );
      expect(output.success).toBe(false);
    });
  });
});
