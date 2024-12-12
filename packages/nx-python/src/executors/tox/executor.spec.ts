import { vi, MockInstance } from 'vitest';
import { vol } from 'memfs';
import '../../utils/mocks/fs.mock';
import '../../utils/mocks/cross-spawn.mock';
import * as poetryUtils from '../../provider/poetry/utils';
import * as buildExecutor from '../build/executor';
import { ToxExecutorSchema } from './schema';
import executor from './executor';
import chalk from 'chalk';
import spawn from 'cross-spawn';
import { ExecutorContext } from '@nx/devkit';
import { UVProvider } from '../../provider/uv';

const options: ToxExecutorSchema = {
  silent: false,
};

describe('Tox Executor', () => {
  let buildExecutorMock: MockInstance;

  const context: ExecutorContext = {
    cwd: '.',
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

  beforeAll(() => {
    console.log(chalk`init chalk`);
  });

  beforeEach(() => {
    buildExecutorMock = vi.spyOn(buildExecutor, 'default');
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

    it('should return success false when the poetry is not installed', async () => {
      checkPoetryExecutableMock.mockRejectedValue(
        new Error('poetry not found'),
      );

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
      expect(activateVenvMock).not.toHaveBeenCalled();
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
      expect(activateVenvMock).not.toHaveBeenCalled();
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
      expect(activateVenvMock).not.toHaveBeenCalled();
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
      expect(activateVenvMock).not.toHaveBeenCalled();
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

  describe('uv', () => {
    let checkPrerequisites: MockInstance;

    beforeEach(() => {
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

    beforeEach(() => {
      vol.fromJSON({
        'uv.lock': '',
      });
    });

    it('should return success false when the uv is not installed', async () => {
      checkPrerequisites.mockRejectedValue(new Error('uv not found'));

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
      expect(checkPrerequisites).toHaveBeenCalled();
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
        'uv',
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

      expect(checkPrerequisites).toHaveBeenCalled();
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
        'uv',
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
      expect(checkPrerequisites).toHaveBeenCalled();
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
      expect(checkPrerequisites).toHaveBeenCalled();
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
});
