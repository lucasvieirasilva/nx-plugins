import { vi } from 'vitest';
import '../../utils/mocks/cross-spawn.mock';
import { readJson, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import generator from './generator';
import projectGenerator from '../poetry-project/generator';
import spawn from 'cross-spawn';

describe('nx-python enable-releases', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = createTreeWithEmptyWorkspace({});
    vi.mocked(spawn.sync).mockReturnValue({
      status: 0,
      output: [''],
      pid: 0,
      signal: null,
      stderr: null,
      stdout: null,
    });
  });

  it('should add release version generator', async () => {
    await projectGenerator(appTree, {
      name: 'proj1',
      projectType: 'application',
      pyprojectPythonDependency: '',
      pyenvPythonVersion: '',
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

    await generator(appTree);

    expect(readJson(appTree, 'proj1/project.json').release).toEqual({
      version: {
        generator: '@nxlv/python:release-version',
      },
    });
  });
});
