import { vi, MockInstance } from 'vitest';
import '../../utils/mocks/cross-spawn.mock';
import * as poetryUtils from '../../provider/poetry/utils';
import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import generator from './generator';
import projectGenerator from '../project/generator';
import spawn from 'cross-spawn';

describe('nx-python migrate-shared-venv generator', () => {
  let checkPoetryExecutableMock: MockInstance;
  let appTree: Tree;

  beforeEach(() => {
    appTree = createTreeWithEmptyWorkspace({
      layout: 'apps-libs',
    });
    checkPoetryExecutableMock = vi.spyOn(poetryUtils, 'checkPoetryExecutable');
    checkPoetryExecutableMock.mockResolvedValue(undefined);
    vi.mocked(spawn.sync).mockReturnValue({
      status: 0,
      output: [''],
      pid: 0,
      signal: null,
      stderr: null,
      stdout: null,
    });
  });

  it('should throw an exception when the poetry is not installed', async () => {
    checkPoetryExecutableMock.mockRejectedValue(new Error('poetry not found'));

    expect(
      generator(appTree, {
        moveDevDependencies: true,
        pyenvPythonVersion: '3.8.11',
        pyprojectPythonDependency: '>=3.8,<3.10',
        autoActivate: false,
      }),
    ).rejects.toThrow('poetry not found');

    expect(checkPoetryExecutableMock).toHaveBeenCalled();
  });

  it('should migrate an isolate venv to shared venv', async () => {
    await projectGenerator(appTree, {
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
    await projectGenerator(appTree, {
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
    await projectGenerator(appTree, {
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
    });
    task();

    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    expect(appTree.read('pyproject.toml', 'utf-8')).toMatchSnapshot();
  });
});
