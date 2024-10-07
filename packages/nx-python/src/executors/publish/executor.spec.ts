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

import chalk from 'chalk';
import '../../utils/mocks/cross-spawn.mock';
import * as poetryUtils from '../utils/poetry';
import executor from './executor';
import spawn from 'cross-spawn';

describe('Publish Executor', () => {
  let checkPoetryExecutableMock: MockInstance;
  let activateVenvMock: MockInstance;

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

  beforeEach(() => {
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
    vi.resetAllMocks();
  });

  it('should return success false when the poetry is not installed', async () => {
    checkPoetryExecutableMock.mockRejectedValue(new Error('poetry not found'));

    const options = {
      buildTarget: 'build',
      silent: false,
      dryRun: false,
    };

    const output = await executor(options, context);
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    expect(activateVenvMock).toHaveBeenCalledWith('.');
    expect(spawn.sync).not.toHaveBeenCalled();
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
    expect(spawn.sync).not.toHaveBeenCalled();
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
    expect(spawn.sync).not.toHaveBeenCalled();
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

    const output = await executor(options, context);
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    expect(activateVenvMock).toHaveBeenCalledWith('.');
    expect(spawn.sync).toHaveBeenCalledWith('poetry', ['publish'], {
      cwd: 'tmp',
      shell: false,
      stdio: 'inherit',
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

    const output = await executor(options, context);
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    expect(activateVenvMock).toHaveBeenCalledWith('.');
    expect(spawn.sync).toHaveBeenCalledWith(
      'poetry',
      ['publish', '-vvv', '--dry-run'],
      {
        cwd: 'tmp',
        shell: false,
        stdio: 'inherit',
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
});
