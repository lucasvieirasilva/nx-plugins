import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  Tree,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nx/devkit';
import generator from '../../generators/poetry-project/generator';
import * as poetryUtils from '../../executors/utils/poetry';

import update from './replace-nx-run-commands';

describe('16-1-0-replace-nx-run-commands migration', () => {
  let tree: Tree;
  let checkPoetryExecutableMock: jest.SpyInstance;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    checkPoetryExecutableMock = jest
      .spyOn(poetryUtils, 'checkPoetryExecutable')
      .mockResolvedValue(undefined);
  });

  it('should run successfully', async () => {
    await generator(tree, {
      name: 'test',
      projectType: 'application',
      pyprojectPythonDependency: '',
      pyenvPythonVersion: '',
      publishable: false,
      buildLockedVersions: false,
      buildBundleLocalDependencies: false,
      linter: 'none',
      unitTestRunner: 'pytest',
      rootPyprojectDependencyGroup: 'main',
      unitTestHtmlReport: false,
      unitTestJUnitReport: false,
      codeCoverage: false,
      codeCoverageHtmlReport: false,
      codeCoverageXmlReport: false,
      projectNameAndRootFormat: 'derived',
    });

    const projectConfig = readProjectConfiguration(tree, 'test');
    projectConfig.targets.lock.executor = 'nx:run-commands';
    projectConfig.targets.test.executor = 'nx:run-commands';

    updateProjectConfiguration(tree, 'test', projectConfig);

    await update(tree);

    const updatedProjectConfig = readProjectConfiguration(tree, 'test');

    expect(updatedProjectConfig.targets.lock.executor).toEqual(
      '@nxlv/python:run-commands'
    );
    expect(updatedProjectConfig.targets.test.executor).toEqual(
      '@nxlv/python:run-commands'
    );
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
  });
});
