import { vi, MockInstance } from 'vitest';
import { vol } from 'memfs';
import '../../utils/mocks/fs.mock';
import '../../utils/mocks/cross-spawn.mock';
import * as poetryUtils from '../utils/poetry';
import * as buildExecutor from '../build/executor';
import { ToxExecutorSchema } from './schema';
import executor from './executor';
import chalk from 'chalk';
import spawn from 'cross-spawn';

const options: ToxExecutorSchema = {
  silent: false,
};

describe('Tox Executor', () => {
  let checkPoetryExecutableMock: MockInstance;
  let activateVenvMock: MockInstance;
  let buildExecutorMock: MockInstance;

  const context = {
    cwd: '.',
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

  beforeAll(() => {
    console.log(chalk`init chalk`);
  });

  beforeEach(() => {
    checkPoetryExecutableMock = vi
      .spyOn(poetryUtils, 'checkPoetryExecutable')
      .mockResolvedValue(undefined);
    activateVenvMock = vi
      .spyOn(poetryUtils, 'activateVenv')
      .mockReturnValue(undefined);

    buildExecutorMock = vi.spyOn(buildExecutor, 'default');

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

  afterEach(() => {
    vol.reset();
    vi.resetAllMocks();
  });

  it('should return success false when the poetry is not installed', async () => {
    checkPoetryExecutableMock.mockRejectedValue(new Error('poetry not found'));

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
    expect(activateVenvMock).toHaveBeenCalledWith('.');
    expect(buildExecutorMock).not.toHaveBeenCalled();
    expect(spawn.sync).not.toHaveBeenCalled();
    expect(output.success).toBe(false);
  });

  it('should build and run tox successfully', async () => {
    buildExecutorMock.mockResolvedValue({
      success: true,
    });

    vol.fromJSON({
      'apps/app/dist/package.tar.gz': 'fake',
    });

    const output = await executor(options, context);
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    expect(activateVenvMock).toHaveBeenCalledWith('.');
    expect(buildExecutorMock).toBeCalledWith(
      {
        silent: options.silent,
        keepBuildFolder: false,
        ignorePaths: ['.venv', '.tox', 'tests'],
        outputPath: 'apps/app/dist',
        devDependencies: true,
        lockedVersions: true,
        bundleLocalDependencies: true,
      },
      context,
    );
    expect(spawn.sync).toBeCalledWith(
      'poetry',
      ['run', 'tox', '--installpkg', 'dist/package.tar.gz'],
      {
        cwd: 'apps/app',
        shell: false,
        stdio: 'inherit',
      },
    );
    expect(output.success).toBe(true);
  });

  it('should build and run tox successfully with args', async () => {
    buildExecutorMock.mockResolvedValue({
      success: true,
    });

    vol.fromJSON({
      'apps/app/dist/package.tar.gz': 'fake',
    });

    const output = await executor(
      {
        silent: false,
        args: '-e linters',
      },
      context,
    );

    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    expect(activateVenvMock).toHaveBeenCalledWith('.');
    expect(buildExecutorMock).toBeCalledWith(
      {
        silent: options.silent,
        keepBuildFolder: false,
        ignorePaths: ['.venv', '.tox', 'tests'],
        outputPath: 'apps/app/dist',
        devDependencies: true,
        lockedVersions: true,
        bundleLocalDependencies: true,
      },
      context,
    );
    expect(spawn.sync).toBeCalledWith(
      'poetry',
      ['run', 'tox', '--installpkg', 'dist/package.tar.gz', '-e', 'linters'],
      {
        cwd: 'apps/app',
        shell: false,
        stdio: 'inherit',
      },
    );
    expect(output.success).toBe(true);
  });

  it('should failure the build and not run tox command', async () => {
    buildExecutorMock.mockResolvedValue({
      success: false,
    });

    const output = await executor(options, context);
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    expect(activateVenvMock).toHaveBeenCalledWith('.');
    expect(buildExecutorMock).toBeCalledWith(
      {
        silent: options.silent,
        keepBuildFolder: false,
        ignorePaths: ['.venv', '.tox', 'tests'],
        outputPath: 'apps/app/dist',
        devDependencies: true,
        lockedVersions: true,
        bundleLocalDependencies: true,
      },
      context,
    );
    expect(spawn.sync).not.toBeCalled();
    expect(output.success).toBe(false);
  });

  it('should dist folder not exists and not run tox command', async () => {
    buildExecutorMock.mockResolvedValue({
      success: true,
    });

    const output = await executor(options, context);
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    expect(activateVenvMock).toHaveBeenCalledWith('.');
    expect(buildExecutorMock).toBeCalledWith(
      {
        silent: options.silent,
        keepBuildFolder: false,
        ignorePaths: ['.venv', '.tox', 'tests'],
        outputPath: 'apps/app/dist',
        devDependencies: true,
        lockedVersions: true,
        bundleLocalDependencies: true,
      },
      context,
    );
    expect(spawn.sync).not.toBeCalled();
    expect(output.success).toBe(false);
  });

  it('should not generate the tar.gz and not run tox command', async () => {
    vol.fromJSON({
      'apps/app/dist/something.txt': 'fake',
    });

    buildExecutorMock.mockResolvedValue({
      success: true,
    });

    const output = await executor(options, context);
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    expect(activateVenvMock).toHaveBeenCalledWith('.');
    expect(buildExecutorMock).toBeCalledWith(
      {
        silent: options.silent,
        keepBuildFolder: false,
        ignorePaths: ['.venv', '.tox', 'tests'],
        outputPath: 'apps/app/dist',
        devDependencies: true,
        lockedVersions: true,
        bundleLocalDependencies: true,
      },
      context,
    );
    expect(spawn.sync).not.toBeCalled();
    expect(output.success).toBe(false);
  });
});
