import { vi } from 'vitest';
import '../../utils/mocks/cross-spawn.mock';
import { readJson, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import generator from './generator';
import projectGenerator from '../poetry-project/generator';
import spawn from 'cross-spawn';
import * as poetryUtils from '../../provider/poetry/utils';

describe('nx-python enable-releases', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = createTreeWithEmptyWorkspace({});

    vi.spyOn(poetryUtils, 'checkPoetryExecutable').mockReturnValue(undefined);
    vi.spyOn(poetryUtils, 'getPoetryVersion').mockResolvedValue('1.8.2');
    vi.mocked(spawn.sync).mockImplementation((command) => {
      if (command === 'python') {
        return {
          status: 0,
          output: [''],
          pid: 0,
          signal: null,
          stderr: null,
          stdout: Buffer.from('Python 3.9.7'),
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

  it('should add release version generator (legacy versioning)', async () => {
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

    await generator(appTree, {
      useNxReleaseLegacyVersioning: true,
    });

    expect(readJson(appTree, 'proj1/project.json').release).toEqual({
      version: {
        generator: '@nxlv/python:release-version',
      },
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

    await generator(appTree, {
      useNxReleaseLegacyVersioning: false,
    });

    expect(readJson(appTree, 'proj1/project.json').release).toEqual({
      version: {
        versionActions: '@nxlv/python/src/release/version-actions',
      },
    });
  });
});
