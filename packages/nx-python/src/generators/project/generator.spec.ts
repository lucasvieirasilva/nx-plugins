import { spawnSyncMock } from '../../utils/mocks/cross-spawn.mock';
import * as poetryUtils from '../../executors/utils/poetry';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Tree, readProjectConfiguration } from '@nrwl/devkit';

import generator from './generator';
import { Schema } from './schema';
import dedent from 'string-dedent';

describe('nx-python project generator', () => {
  let checkPoetryExecutableMock: jest.SpyInstance;
  let appTree: Tree;
  const options: Schema = {
    name: 'test',
    type: 'application',
    moduleName: null,
    packageName: 'unittest-test-pkg-name',
    publishable: true,
    customSource: false,
    addDevDependencies: false,
  };

  beforeEach(() => {
    appTree = createTreeWithEmptyWorkspace({
      layout: 'apps-libs',
    });
    checkPoetryExecutableMock = jest.spyOn(
      poetryUtils,
      'checkPoetryExecutable'
    );
    checkPoetryExecutableMock.mockResolvedValue(undefined);
    spawnSyncMock.mockReturnValue({ status: 0 });
  });

  it('should throw an exception when the poetry is not installed', async () => {
    checkPoetryExecutableMock.mockRejectedValue(new Error('poetry not found'));

    expect(generator(appTree, options)).rejects.toThrow('poetry not found');

    expect(checkPoetryExecutableMock).toHaveBeenCalled();
  });

  it('should successfully generate a python project', async () => {
    await generator(appTree, options);
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    const config = readProjectConfiguration(appTree, 'test');
    expect(config).toMatchSnapshot();

    assertGenerateFiles(appTree, 'apps/test', 'test');
  });

  it('should successfully generate a python project with custom module name', async () => {
    await generator(appTree, { ...options, moduleName: 'mymodule' });
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    const config = readProjectConfiguration(appTree, 'test');
    expect(config).toMatchSnapshot();

    assertGenerateFiles(appTree, 'apps/test', 'mymodule');
  });

  it('should successfully generate a python library project', async () => {
    await generator(appTree, { ...options, type: 'library' });
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    const config = readProjectConfiguration(appTree, 'test');
    expect(config).toMatchSnapshot();

    assertGenerateFiles(appTree, 'libs/test', 'test');
  });

  it('should successfully generate a python library project with dev dependencies', async () => {
    await generator(appTree, {
      ...options,
      type: 'library',
      addDevDependencies: true,
    });
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    const config = readProjectConfiguration(appTree, 'test');
    expect(config).toMatchSnapshot();

    assertGenerateFiles(appTree, 'libs/test', 'test');
  });

  it('should generate a python project into a different folder', async () => {
    await generator(appTree, {
      ...options,
      directory: 'shared',
    });
    const config = readProjectConfiguration(appTree, 'shared-test');
    expect(config).toMatchSnapshot();

    assertGenerateFiles(appTree, 'apps/shared/test', 'shared_test');
  });

  it('should generate a python project using description option', async () => {
    await generator(appTree, {
      ...options,
      description: 'My custom description',
    });
    expect(
      appTree.read('apps/test/pyproject.toml').toString()
    ).toMatchSnapshot();
  });

  it('should generate a python project using custom source', async () => {
    await generator(appTree, {
      ...options,
      customSource: true,
      sourceName: 'aws',
      sourceUrl: 'https://custom.com',
      sourceSecondary: true,
    });
    expect(
      appTree.read('apps/test/pyproject.toml').toString()
    ).toMatchSnapshot();
  });

  it('should not generate a python project when the customSource is true and the name or url is empty', async () => {
    await expect(
      generator(appTree, {
        ...options,
        customSource: true,
      })
    ).rejects.toThrow(
      "Fields 'sourceName', 'sourceUrl' are required when the flag 'customSource' is true"
    );
  });

  it('should generate a python project with tags', async () => {
    await generator(appTree, {
      ...options,
      tags: 'python-project, nx, poetry, tox',
    });
    const config = readProjectConfiguration(appTree, 'test');
    expect(config).toMatchSnapshot();
  });

  it('should successfully generate a python library project with root pyproject.toml', async () => {
    appTree.write(
      'pyproject.toml',
      dedent`
    [tool.poetry]
    name = "unit test"

      [tool.poetry.dependencies]
      python = ">=3.8,<3.10"

    [build-system]
    requires = [ "poetry-core==1.0.3" ]
    build-backend = "poetry.core.masonry.api"
    `
    );

    const callbackTask = await generator(appTree, {
      ...options,
      type: 'library',
    });
    callbackTask();
    const config = readProjectConfiguration(appTree, 'test');
    expect(config).toMatchSnapshot();

    expect(appTree.read('pyproject.toml', 'utf8')).toMatchSnapshot();
    expect(spawnSyncMock).toHaveBeenCalledWith(
      'poetry',
      ['update', options.packageName],
      {
        shell: false,
        stdio: 'inherit',
      }
    );
  });
});

function assertGenerateFiles(
  appTree: Tree,
  projectDirectory: string,
  moduleName: string
) {
  expect(appTree.exists(`${projectDirectory}/tox.ini`)).toBeTruthy();
  expect(
    appTree.read(`${projectDirectory}/tox.ini`).toString()
  ).toMatchSnapshot();
  expect(appTree.exists(`${projectDirectory}/README.md`)).toBeTruthy();
  expect(
    appTree.read(`${projectDirectory}/README.md`).toString()
  ).toMatchSnapshot();
  expect(appTree.exists(`${projectDirectory}/pyproject.toml`)).toBeTruthy();
  expect(
    appTree.read(`${projectDirectory}/pyproject.toml`).toString()
  ).toMatchSnapshot();
  expect(appTree.exists(`${projectDirectory}/CHANGELOG.md`)).toBeTruthy();
  expect(
    appTree.read(`${projectDirectory}/CHANGELOG.md`).toString()
  ).toMatchSnapshot();
  expect(appTree.exists(`${projectDirectory}/.flake8`)).toBeTruthy();
  expect(
    appTree.read(`${projectDirectory}/.flake8`).toString()
  ).toMatchSnapshot();
  expect(
    appTree.exists(`${projectDirectory}/${moduleName}/index.py`)
  ).toBeTruthy();
  expect(
    appTree.read(`${projectDirectory}/${moduleName}/index.py`).toString()
  ).toMatchSnapshot();
  expect(
    appTree.exists(`${projectDirectory}/tests/test_index.py`)
  ).toBeTruthy();
  expect(
    appTree.read(`${projectDirectory}/tests/test_index.py`).toString()
  ).toMatchSnapshot();
}
