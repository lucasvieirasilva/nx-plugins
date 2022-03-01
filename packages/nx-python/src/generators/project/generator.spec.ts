import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Tree, readProjectConfiguration } from '@nrwl/devkit';

import generator from './generator';
import { Schema } from './schema';

describe('nx-python project generator', () => {
  let appTree: Tree;
  const options: Schema = {
    name: 'test',
    type: 'application',
    packageName: 'unittest-test-pkg-name',
    publishable: true,
    customSource: false,
  };

  beforeEach(() => {
    appTree = createTreeWithEmptyWorkspace();
  });

  it('should successfully generate a python project', async () => {
    await generator(appTree, options);
    const config = readProjectConfiguration(appTree, 'test');
    expect(config).toMatchSnapshot();

    assertGenerateFiles(appTree, 'apps/test', 'test');
  });

  it('should successfully generate a python library project', async () => {
    await generator(appTree, { ...options, type: 'library' });
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
