import { vi, MockInstance } from 'vitest';

const fsExtraMocks = vi.hoisted(() => {
  return {
    removeSync: vi.fn(),
  };
});

const nxDevkitMocks = vi.hoisted(() => {
  return {
    runExecutor: vi.fn(),
  };
});

const childProcessMocks = vi.hoisted(() => {
  return {
    spawn: vi.fn(),
  };
});

vi.mock('@nx/devkit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nx/devkit')>();
  return {
    ...actual,
    ...nxDevkitMocks,
  };
});

vi.mock('fs-extra', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs-extra')>();
  return {
    ...actual,
    ...fsExtraMocks,
  };
});

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    ...childProcessMocks,
  };
});

import chalk from 'chalk';
import * as poetryUtils from '../../provider/poetry/utils';
import executor from './executor';
import { EventEmitter } from 'events';
import { ExecutorContext } from '@nx/devkit';

describe('Publish Executor', () => {
  beforeAll(() => {
    console.log(chalk`init chalk`);
  });

  afterEach(() => {
    vi.resetAllMocks();
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

  describe('poetry', () => {
    let checkPoetryExecutableMock: MockInstance;
    let activateVenvMock: MockInstance;

    beforeEach(() => {
      checkPoetryExecutableMock = vi
        .spyOn(poetryUtils, 'checkPoetryExecutable')
        .mockResolvedValue(undefined);

      activateVenvMock = vi
        .spyOn(poetryUtils, 'activateVenv')
        .mockReturnValue(undefined);

      vi.spyOn(process, 'chdir').mockReturnValue(undefined);
    });

    it('should return success false when the poetry is not installed', async () => {
      checkPoetryExecutableMock.mockRejectedValue(
        new Error('poetry not found'),
      );

      const options = {
        buildTarget: 'build',
        silent: false,
        dryRun: false,
      };

      const output = await executor(options, context);
      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.');
      expect(childProcessMocks.spawn).not.toHaveBeenCalled();
      expect(output.success).toBe(false);
    });

    it('should return success false when the build target fails', async () => {
      nxDevkitMocks.runExecutor.mockResolvedValueOnce([{ success: false }]);

      const options = {
        buildTarget: 'build',
        silent: false,
        dryRun: false,
      };

      const output = await executor(options, context);
      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.');
      expect(childProcessMocks.spawn).not.toHaveBeenCalled();
      expect(output.success).toBe(false);
    });

    it('should return success false when the build target does not return the temp folder', async () => {
      nxDevkitMocks.runExecutor.mockResolvedValueOnce([{ success: true }]);

      const options = {
        buildTarget: 'build',
        silent: false,
        dryRun: false,
        __unparsed__: [],
      };

      const output = await executor(options, context);
      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.');
      expect(childProcessMocks.spawn).not.toHaveBeenCalled();
      expect(output.success).toBe(false);
    });

    it('should run poetry publish command without agrs', async () => {
      nxDevkitMocks.runExecutor.mockResolvedValueOnce([
        { success: true, buildFolderPath: 'tmp' },
      ]);
      fsExtraMocks.removeSync.mockReturnValue(undefined);

      const options = {
        buildTarget: 'build',
        silent: false,
        dryRun: false,
      };

      const spawnEvent = new EventEmitter();
      childProcessMocks.spawn.mockReturnValue({
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        on: vi.fn().mockImplementation((event, callback) => {
          spawnEvent.on(event, callback);
          spawnEvent.emit('close', 0);
        }),
      });

      const output = await executor(options, context);
      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.');
      expect(childProcessMocks.spawn).toHaveBeenCalledWith('poetry publish', {
        cwd: 'tmp',
        env: { ...process.env, FORCE_COLOR: 'true' },
        shell: true,
        stdio: ['inherit', 'pipe', 'pipe'],
      });
      expect(output.success).toBe(true);
      expect(nxDevkitMocks.runExecutor).toHaveBeenCalledWith(
        {
          configuration: undefined,
          project: 'app',
          target: 'build',
        },
        {
          keepBuildFolder: true,
        },
        context,
      );
      expect(fsExtraMocks.removeSync).toHaveBeenCalledWith('tmp');
    });

    it('should run poetry publish command with agrs', async () => {
      nxDevkitMocks.runExecutor.mockResolvedValueOnce([
        { success: true, buildFolderPath: 'tmp' },
      ]);
      fsExtraMocks.removeSync.mockReturnValue(undefined);

      const options = {
        buildTarget: 'build',
        dryRun: false,
        silent: false,
        __unparsed__: ['-vvv', '--dry-run'],
      };

      const spawnEvent = new EventEmitter();
      childProcessMocks.spawn.mockReturnValue({
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        on: vi.fn().mockImplementation((event, callback) => {
          spawnEvent.on(event, callback);
          spawnEvent.emit('close', 0);
        }),
      });

      const output = await executor(options, context);
      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.');
      expect(childProcessMocks.spawn).toHaveBeenCalledWith(
        'poetry publish -vvv --dry-run',
        {
          cwd: 'tmp',
          env: { ...process.env, FORCE_COLOR: 'true' },
          shell: true,
          stdio: ['inherit', 'pipe', 'pipe'],
        },
      );
      expect(output.success).toBe(true);
      expect(nxDevkitMocks.runExecutor).toHaveBeenCalledWith(
        {
          configuration: undefined,
          project: 'app',
          target: 'build',
        },
        {
          keepBuildFolder: true,
        },
        context,
      );
      expect(fsExtraMocks.removeSync).toHaveBeenCalledWith('tmp');
    });

    it('should run poetry publish and not throw an exception when the message contains "File already exists"', async () => {
      nxDevkitMocks.runExecutor.mockResolvedValueOnce([
        { success: true, buildFolderPath: 'tmp' },
      ]);
      fsExtraMocks.removeSync.mockReturnValue(undefined);

      const options = {
        buildTarget: 'build',
        dryRun: false,
        silent: false,
      };

      const spawnEvent = new EventEmitter();
      const stdoutEvent = new EventEmitter();
      childProcessMocks.spawn.mockReturnValue({
        stdout: {
          on: vi.fn().mockImplementation((event, callback) => {
            stdoutEvent.on(event, callback);
            stdoutEvent.emit(event, 'HTTP Error 400: File already exists');
          }),
        },
        stderr: new EventEmitter(),
        on: vi.fn().mockImplementation((event, callback) => {
          spawnEvent.on(event, callback);
          spawnEvent.emit('close', 1);
        }),
      });

      const output = await executor(options, context);
      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.');
      expect(childProcessMocks.spawn).toHaveBeenCalledWith('poetry publish', {
        cwd: 'tmp',
        env: { ...process.env, FORCE_COLOR: 'true' },
        shell: true,
        stdio: ['inherit', 'pipe', 'pipe'],
      });
      expect(output.success).toBe(true);
      expect(nxDevkitMocks.runExecutor).toHaveBeenCalledWith(
        {
          configuration: undefined,
          project: 'app',
          target: 'build',
        },
        {
          keepBuildFolder: true,
        },
        context,
      );
      expect(fsExtraMocks.removeSync).toHaveBeenCalledWith('tmp');
    });

    it('should throw an exception when status code is not 0 and the message does not contains "File already exists"', async () => {
      nxDevkitMocks.runExecutor.mockResolvedValueOnce([
        { success: true, buildFolderPath: 'tmp' },
      ]);
      fsExtraMocks.removeSync.mockReturnValue(undefined);

      const options = {
        buildTarget: 'build',
        dryRun: false,
        silent: false,
      };

      const spawnEvent = new EventEmitter();
      const stdoutEvent = new EventEmitter();
      childProcessMocks.spawn.mockReturnValue({
        stdout: {
          on: vi.fn().mockImplementation((event, callback) => {
            stdoutEvent.on(event, callback);
            stdoutEvent.emit('data', 'Some other error message');
          }),
        },
        stderr: new EventEmitter(),
        on: vi.fn().mockImplementation((event, callback) => {
          spawnEvent.on(event, callback);
          spawnEvent.emit('close', 1);
        }),
      });

      const output = await executor(options, context);
      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.');
      expect(childProcessMocks.spawn).toHaveBeenCalledWith('poetry publish', {
        cwd: 'tmp',
        env: { ...process.env, FORCE_COLOR: 'true' },
        shell: true,
        stdio: ['inherit', 'pipe', 'pipe'],
      });
      expect(output.success).toBe(false);
      expect(nxDevkitMocks.runExecutor).toHaveBeenCalledWith(
        {
          configuration: undefined,
          project: 'app',
          target: 'build',
        },
        {
          keepBuildFolder: true,
        },
        context,
      );
    });
  });
});
