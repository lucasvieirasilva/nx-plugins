import { spawnSyncMock } from '../../utils/mocks/cross-spawn.mock';
import { Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import generator from './generator';
import projectGenerator from '../project/generator';

describe('nx-python migrate-shared-venv generator', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = createTreeWithEmptyWorkspace({
      layout: 'apps-libs',
    });
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
    });

    const task = await generator(appTree, {
      moveDevDependencies: true,
    });
    task();

    expect(
      appTree.read('apps/proj1/pyproject.toml', 'utf-8')
    ).toMatchSnapshot();
    expect(appTree.read('pyproject.toml', 'utf-8')).toMatchSnapshot();
    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      1,
      'poetry',
      ['lock', '--no-update'],
      { cwd: 'apps/proj1', shell: false, stdio: 'inherit' }
    );
    expect(spawnSyncMock).toHaveBeenNthCalledWith(2, 'poetry', ['install'], {
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
    });

    const task = await generator(appTree, {
      moveDevDependencies: true,
    });
    task();

    expect(
      appTree.read('apps/proj1/pyproject.toml', 'utf-8')
    ).toMatchSnapshot();
    expect(appTree.read('pyproject.toml', 'utf-8')).toMatchSnapshot();
    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      1,
      'poetry',
      ['lock', '--no-update'],
      { cwd: 'apps/proj1', shell: false, stdio: 'inherit' }
    );
    expect(spawnSyncMock).toHaveBeenNthCalledWith(2, 'poetry', ['install'], {
      shell: false,
      stdio: 'inherit',
    });
  });
});
