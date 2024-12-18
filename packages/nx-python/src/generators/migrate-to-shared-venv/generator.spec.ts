import { vi, MockInstance } from 'vitest';
import '../../utils/mocks/cross-spawn.mock';
import * as poetryUtils from '../../provider/poetry/utils';
import * as uvUtils from '../../provider/uv/utils';
import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import generator from './generator';
import poetryProjectGenerator from '../project/generator';
import uvProjectGenerator from '../uv-project/generator';
import spawn from 'cross-spawn';

describe('nx-python migrate-shared-venv generator', () => {
  let appTree: Tree;

  beforeEach(() => {
    vi.resetAllMocks();

    appTree = createTreeWithEmptyWorkspace({
      layout: 'apps-libs',
    });
    vi.mocked(spawn.sync).mockImplementation((command) => {
      if (command === 'python') {
        return {
          status: 0,
          output: [''],
          pid: 0,
          signal: null,
          stderr: null,
          stdout: Buffer.from('Python 3.8.11'),
        };
      }

      return {
        status: 0,
        output: [''],
        pid: 0,
        signal: null,
        stderr: null,
        stdout: null,
      };
    });
  });

  describe('poetry', () => {
    let checkPoetryExecutableMock: MockInstance;

    beforeEach(() => {
      checkPoetryExecutableMock = vi.spyOn(
        poetryUtils,
        'checkPoetryExecutable',
      );
      checkPoetryExecutableMock.mockResolvedValue(undefined);
    });

    it('should throw an exception when the poetry is not installed', async () => {
      checkPoetryExecutableMock.mockRejectedValue(
        new Error('poetry not found'),
      );

      expect(
        generator(appTree, {
          moveDevDependencies: true,
          pyenvPythonVersion: '3.8.11',
          pyprojectPythonDependency: '>=3.8,<3.10',
          autoActivate: false,
          packageManager: 'poetry',
        }),
      ).rejects.toThrow('poetry not found');

      expect(checkPoetryExecutableMock).toHaveBeenCalled();
    });

    it('should migrate an isolate venv to shared venv', async () => {
      await poetryProjectGenerator(appTree, {
        name: 'proj1',
        type: 'application',
        publishable: true,
        customSource: false,
        addDevDependencies: true,
        moduleName: 'proj1',
        packageName: 'proj1',
        buildLockedVersions: true,
        buildBundleLocalDependencies: true,
        pyenvPythonVersion: '3.8.11',
        pyprojectPythonDependency: '>=3.8,<3.10',
        toxEnvlist: 'py38',
      });

      const task = await generator(appTree, {
        moveDevDependencies: true,
        pyenvPythonVersion: '3.8.11',
        pyprojectPythonDependency: '>=3.8,<3.10',
        autoActivate: false,
        packageManager: 'poetry',
      });
      task();

      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(
        appTree.read('apps/proj1/pyproject.toml', 'utf-8'),
      ).toMatchSnapshot();
      expect(appTree.read('pyproject.toml', 'utf-8')).toMatchSnapshot();
      expect(appTree.read('.python-version', 'utf-8')).toMatchSnapshot();
      expect(spawn.sync).toHaveBeenNthCalledWith(
        1,
        'poetry',
        ['lock', '--no-update'],
        { cwd: 'apps/proj1', shell: false, stdio: 'inherit' },
      );
      expect(spawn.sync).toHaveBeenNthCalledWith(2, 'poetry', ['install'], {
        shell: false,
        stdio: 'inherit',
      });
    });

    it('should migrate an isolate venv to shared venv project without dev dependencies', async () => {
      await poetryProjectGenerator(appTree, {
        name: 'proj1',
        type: 'application',
        publishable: true,
        customSource: false,
        addDevDependencies: false,
        moduleName: 'proj1',
        packageName: 'proj1',
        buildLockedVersions: true,
        buildBundleLocalDependencies: true,
        pyenvPythonVersion: '3.8.11',
        pyprojectPythonDependency: '>=3.8,<3.10',
        toxEnvlist: 'py38',
      });

      const task = await generator(appTree, {
        moveDevDependencies: true,
        pyenvPythonVersion: '3.8.11',
        pyprojectPythonDependency: '>=3.8,<3.10',
        autoActivate: false,
        packageManager: 'poetry',
      });
      task();

      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(
        appTree.read('apps/proj1/pyproject.toml', 'utf-8'),
      ).toMatchSnapshot();
      expect(appTree.read('pyproject.toml', 'utf-8')).toMatchSnapshot();
      expect(appTree.read('.python-version', 'utf-8')).toMatchSnapshot();
      expect(spawn.sync).toHaveBeenNthCalledWith(
        1,
        'poetry',
        ['lock', '--no-update'],
        { cwd: 'apps/proj1', shell: false, stdio: 'inherit' },
      );
      expect(spawn.sync).toHaveBeenNthCalledWith(2, 'poetry', ['install'], {
        shell: false,
        stdio: 'inherit',
      });
    });

    it('should migrate an isolate venv to shared venv with auto activate enabled', async () => {
      await poetryProjectGenerator(appTree, {
        name: 'proj1',
        type: 'application',
        publishable: true,
        customSource: false,
        addDevDependencies: true,
        moduleName: 'proj1',
        packageName: 'proj1',
        buildLockedVersions: true,
        buildBundleLocalDependencies: true,
        pyenvPythonVersion: '3.8.11',
        pyprojectPythonDependency: '>=3.8,<3.10',
        toxEnvlist: 'py38',
      });

      const task = await generator(appTree, {
        moveDevDependencies: true,
        pyenvPythonVersion: '3.8.11',
        pyprojectPythonDependency: '>=3.8,<3.10',
        autoActivate: true,
        packageManager: 'poetry',
      });
      task();

      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(appTree.read('pyproject.toml', 'utf-8')).toMatchSnapshot();
    });
  });

  describe('uv', () => {
    let checkUvExecutableMock: MockInstance;

    beforeEach(() => {
      checkUvExecutableMock = vi.spyOn(uvUtils, 'checkUvExecutable');
      checkUvExecutableMock.mockResolvedValue(undefined);
    });

    it('should throw an exception when the uv is not installed', async () => {
      checkUvExecutableMock.mockRejectedValue(new Error('uv not found'));

      expect(
        generator(appTree, {
          moveDevDependencies: true,
          pyenvPythonVersion: '3.8.11',
          pyprojectPythonDependency: '>=3.8,<3.10',
          autoActivate: false,
          packageManager: 'uv',
        }),
      ).rejects.toThrow('uv not found');

      expect(checkUvExecutableMock).toHaveBeenCalled();
    });

    it('should migrate an isolate venv to shared venv', async () => {
      await uvProjectGenerator(appTree, {
        name: 'proj1',
        projectType: 'application',
        pyprojectPythonDependency: '',
        publishable: false,
        buildLockedVersions: false,
        buildBundleLocalDependencies: false,
        linter: 'ruff',
        unitTestRunner: 'pytest',
        rootPyprojectDependencyGroup: 'main',
        unitTestHtmlReport: true,
        unitTestJUnitReport: true,
        codeCoverage: true,
        codeCoverageHtmlReport: true,
        codeCoverageXmlReport: true,
        projectNameAndRootFormat: 'derived',
      });

      const task = await generator(appTree, {
        moveDevDependencies: true,
        pyenvPythonVersion: '3.8.11',
        pyprojectPythonDependency: '>=3.8,<3.10',
        autoActivate: false,
        packageManager: 'uv',
      });
      task();

      expect(checkUvExecutableMock).toHaveBeenCalled();
      expect(
        appTree.read('apps/proj1/pyproject.toml', 'utf-8'),
      ).toMatchSnapshot();
      expect(appTree.read('pyproject.toml', 'utf-8')).toMatchSnapshot();
      expect(appTree.read('.python-version', 'utf-8')).toMatchSnapshot();
      expect(spawn.sync).toHaveBeenNthCalledWith(1, 'python', ['--version'], {
        stdio: 'pipe',
      });
      expect(spawn.sync).toHaveBeenNthCalledWith(2, 'uv', ['sync'], {
        shell: false,
        stdio: 'inherit',
      });
    });

    it('should migrate an isolate venv to shared venv project without dev dependencies', async () => {
      await uvProjectGenerator(appTree, {
        name: 'proj1',
        projectType: 'application',
        pyprojectPythonDependency: '',
        publishable: false,
        buildLockedVersions: false,
        buildBundleLocalDependencies: false,
        linter: 'none',
        unitTestRunner: 'none',
        rootPyprojectDependencyGroup: 'main',
        unitTestHtmlReport: false,
        unitTestJUnitReport: false,
        codeCoverage: false,
        codeCoverageHtmlReport: false,
        codeCoverageXmlReport: false,
        projectNameAndRootFormat: 'derived',
      });

      const task = await generator(appTree, {
        moveDevDependencies: true,
        pyenvPythonVersion: '3.8.11',
        pyprojectPythonDependency: '>=3.8,<3.10',
        autoActivate: false,
        packageManager: 'uv',
      });
      task();

      expect(checkUvExecutableMock).toHaveBeenCalled();
      expect(
        appTree.read('apps/proj1/pyproject.toml', 'utf-8'),
      ).toMatchSnapshot();
      expect(appTree.read('pyproject.toml', 'utf-8')).toMatchSnapshot();
      expect(appTree.read('.python-version', 'utf-8')).toMatchSnapshot();
      expect(spawn.sync).toHaveBeenNthCalledWith(1, 'python', ['--version'], {
        stdio: 'pipe',
      });
      expect(spawn.sync).toHaveBeenNthCalledWith(2, 'uv', ['sync'], {
        shell: false,
        stdio: 'inherit',
      });
    });
  });
});
