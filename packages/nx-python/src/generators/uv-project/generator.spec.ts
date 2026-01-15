import { vi, MockInstance } from 'vitest';
import '../../utils/mocks/cross-spawn.mock';
import * as uvUtils from '../../provider/uv/utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  Tree,
  readNxJson,
  readProjectConfiguration,
  updateNxJson,
} from '@nx/devkit';

import generator, { UVProjectGeneratorSchema } from './generator';
import dedent from 'string-dedent';
import { parse, stringify } from '@iarna/toml';
import path from 'path';
import spawn from 'cross-spawn';
import { UVPyprojectToml } from '../../provider/uv/types';

describe('application generator', () => {
  let checkUvExecutable: MockInstance;
  let appTree: Tree;
  const options: UVProjectGeneratorSchema = {
    name: 'test',
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
    buildSystem: 'hatch',
    srcDir: false,
  };

  beforeEach(() => {
    vi.resetAllMocks();

    appTree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    checkUvExecutable = vi.spyOn(uvUtils, 'checkUvExecutable');
    checkUvExecutable.mockResolvedValue(undefined);
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

  it('should throw an exception when the uv is not installed', async () => {
    checkUvExecutable.mockRejectedValue(new Error('uv not found'));

    expect(generator(appTree, options)).rejects.toThrow('uv not found');

    expect(checkUvExecutable).toHaveBeenCalled();
  });

  describe('as-provided', () => {
    it('should run successfully minimal configuration', async () => {
      await generator(appTree, {
        ...options,
        name: 'my-app-test',
        directory: 'src/app/test',
        projectNameAndRootFormat: 'as-provided',
      });
      const config = readProjectConfiguration(appTree, 'my-app-test');
      expect(config).toMatchSnapshot();

      const projectDirectory = 'src/app/test';
      const moduleName = 'my_app_test';

      assertGeneratedFilesBase(appTree, projectDirectory, moduleName);

      expect(
        appTree.exists(`${projectDirectory}/tests/test_hello.py`),
      ).toBeFalsy();
    });

    it('should run successfully minimal configuration without directory', async () => {
      await generator(appTree, {
        ...options,
        name: 'my-app-test',
        projectNameAndRootFormat: 'as-provided',
      });
      const config = readProjectConfiguration(appTree, 'my-app-test');
      expect(config).toMatchSnapshot();

      const projectDirectory = 'my-app-test';
      const moduleName = 'my_app_test';

      assertGeneratedFilesBase(appTree, projectDirectory, moduleName);

      expect(
        appTree.exists(`${projectDirectory}/tests/test_hello.py`),
      ).toBeFalsy();
    });

    it('should run successfully with useSyncGenerators option', async () => {
      await generator(appTree, {
        ...options,
        name: 'my-app-test',
        directory: 'src/app/test',
        projectNameAndRootFormat: 'as-provided',
        useSyncGenerators: true,
      });
      const config = readProjectConfiguration(appTree, 'my-app-test');
      expect(config).toMatchSnapshot();

      const projectDirectory = 'src/app/test';
      const moduleName = 'my_app_test';

      assertGeneratedFilesBase(appTree, projectDirectory, moduleName);

      expect(
        appTree.exists(`${projectDirectory}/tests/test_hello.py`),
      ).toBeFalsy();

      expect(appTree.read('nx.json', 'utf-8')).toMatchSnapshot();
    });

    it('should run successfully with useSyncGenerators option (infer already enabled)', async () => {
      const nxJson = readNxJson(appTree);
      updateNxJson(appTree, {
        ...nxJson,
        plugins: [
          {
            plugin: '@nxlv/python',
            options: {
              inferDependencies: true,
            },
          },
        ],
      });

      await generator(appTree, {
        ...options,
        name: 'my-app-test',
        directory: 'src/app/test',
        projectNameAndRootFormat: 'as-provided',
        useSyncGenerators: true,
      });
      const config = readProjectConfiguration(appTree, 'my-app-test');
      expect(config).toMatchSnapshot();

      const projectDirectory = 'src/app/test';
      const moduleName = 'my_app_test';

      assertGeneratedFilesBase(appTree, projectDirectory, moduleName);

      expect(
        appTree.exists(`${projectDirectory}/tests/test_hello.py`),
      ).toBeFalsy();

      expect(appTree.read('nx.json', 'utf-8')).toMatchSnapshot();
    });
  });

  it('should run successfully with minimal options', async () => {
    const callbackTask = await generator(appTree, options);
    await callbackTask();
    const config = readProjectConfiguration(appTree, 'test');
    expect(config).toMatchSnapshot();

    const projectDirectory = 'apps/test';
    const moduleName = 'test';

    assertGeneratedFilesBase(appTree, projectDirectory, moduleName);

    expect(appTree.exists(`${projectDirectory}/.flake8`)).toBeFalsy();
    expect(
      appTree.exists(`${projectDirectory}/tests/test_hello.py`),
    ).toBeFalsy();

    expect(appTree.read('pyproject.toml', 'utf-8')).toMatchSnapshot();

    expect(spawn.sync).toHaveBeenCalledTimes(1);
    expect(spawn.sync).toHaveBeenNthCalledWith(1, 'python', ['--version'], {
      stdio: 'pipe',
    });
  });

  it('should run successfully with minimal options (new release versioning)', async () => {
    const callbackTask = await generator(appTree, {
      ...options,
    });
    await callbackTask();
    const config = readProjectConfiguration(appTree, 'test');
    expect(config).toMatchSnapshot();

    const projectDirectory = 'apps/test';
    const moduleName = 'test';

    assertGeneratedFilesBase(appTree, projectDirectory, moduleName);

    expect(appTree.exists(`${projectDirectory}/.flake8`)).toBeFalsy();
    expect(
      appTree.exists(`${projectDirectory}/tests/test_hello.py`),
    ).toBeFalsy();

    expect(appTree.read('pyproject.toml', 'utf-8')).toMatchSnapshot();

    expect(spawn.sync).toHaveBeenCalledTimes(1);
    expect(spawn.sync).toHaveBeenNthCalledWith(1, 'python', ['--version'], {
      stdio: 'pipe',
    });
  });

  describe('project', () => {
    it('should run successfully minimal configuration as a library', async () => {
      await generator(appTree, {
        ...options,
        projectType: 'library',
      });
      const config = readProjectConfiguration(appTree, 'test');
      expect(config).toMatchSnapshot();

      const projectDirectory = 'libs/test';
      const moduleName = 'test';

      assertGeneratedFilesBase(appTree, projectDirectory, moduleName);

      expect(appTree.exists(`${projectDirectory}/.flake8`)).toBeFalsy();
      expect(
        appTree.exists(`${projectDirectory}/tests/test_hello.py`),
      ).toBeFalsy();
      expect(appTree.read('pyproject.toml', 'utf-8')).toMatchSnapshot();
    });

    it('should run successfully minimal configuration with tags', async () => {
      await generator(appTree, {
        ...options,
        tags: 'one,two',
      });
      const config = readProjectConfiguration(appTree, 'test');
      expect(config).toMatchSnapshot();

      const projectDirectory = 'apps/test';
      const moduleName = 'test';

      assertGeneratedFilesBase(appTree, projectDirectory, moduleName);
      expect(appTree.read('pyproject.toml', 'utf-8')).toMatchSnapshot();
    });

    it('should run successfully minimal configuration custom directory', async () => {
      await generator(appTree, {
        ...options,
        directory: 'subdir',
      });
      const config = readProjectConfiguration(appTree, 'subdir-test');
      expect(config).toMatchSnapshot();

      const projectDirectory = 'apps/subdir/test';
      const moduleName = 'subdir_test';

      assertGeneratedFilesBase(appTree, projectDirectory, moduleName);
      expect(appTree.read('pyproject.toml', 'utf-8')).toMatchSnapshot();
    });

    it('should run successfully with flake8 linter', async () => {
      await generator(appTree, {
        ...options,
        linter: 'flake8',
      });
      const config = readProjectConfiguration(appTree, 'test');
      expect(config).toMatchSnapshot();

      assertGeneratedFilesBase(appTree, 'apps/test', 'test');
      assertGeneratedFilesFlake8(appTree, 'apps/test');
      expect(appTree.read('pyproject.toml', 'utf-8')).toMatchSnapshot();
    });

    it('should run successfully with ruff linter', async () => {
      await generator(appTree, {
        ...options,
        linter: 'ruff',
      });
      const config = readProjectConfiguration(appTree, 'test');
      expect(config).toMatchSnapshot();

      assertGeneratedFilesBase(appTree, 'apps/test', 'test');
      expect(appTree.read('pyproject.toml', 'utf-8')).toMatchSnapshot();
    });

    it('should run successfully with flake8 linter and pytest with no reports', async () => {
      await generator(appTree, {
        ...options,
        linter: 'flake8',
        unitTestRunner: 'pytest',
      });
      const config = readProjectConfiguration(appTree, 'test');
      expect(config).toMatchSnapshot();

      assertGeneratedFilesBase(appTree, 'apps/test', 'test');
      assertGeneratedFilesFlake8(appTree, 'apps/test');
      assertGeneratedFilesPyTest(appTree, 'apps/test');
      expect(appTree.read('pyproject.toml', 'utf-8')).toMatchSnapshot();
    });

    it('should run successfully with ruff linter and pytest with no reports', async () => {
      await generator(appTree, {
        ...options,
        linter: 'ruff',
        unitTestRunner: 'pytest',
      });
      const config = readProjectConfiguration(appTree, 'test');
      expect(config).toMatchSnapshot();

      assertGeneratedFilesBase(appTree, 'apps/test', 'test');
      assertGeneratedFilesPyTest(appTree, 'apps/test');
      expect(appTree.read('pyproject.toml', 'utf-8')).toMatchSnapshot();
    });

    it('should run successfully with flake8 linter and pytest with html coverage report', async () => {
      await generator(appTree, {
        ...options,
        linter: 'flake8',
        unitTestRunner: 'pytest',
        codeCoverage: true,
        codeCoverageHtmlReport: true,
      });
      const config = readProjectConfiguration(appTree, 'test');
      expect(config).toMatchSnapshot();

      assertGeneratedFilesBase(appTree, 'apps/test', 'test');
      assertGeneratedFilesFlake8(appTree, 'apps/test');
      assertGeneratedFilesPyTest(appTree, 'apps/test');
      expect(appTree.read('pyproject.toml', 'utf-8')).toMatchSnapshot();
    });

    it('should run successfully with flake8 linter and pytest with html,xml coverage reports', async () => {
      await generator(appTree, {
        ...options,
        linter: 'flake8',
        unitTestRunner: 'pytest',
        codeCoverage: true,
        codeCoverageHtmlReport: true,
        codeCoverageXmlReport: true,
      });
      const config = readProjectConfiguration(appTree, 'test');
      expect(config).toMatchSnapshot();

      assertGeneratedFilesBase(appTree, 'apps/test', 'test');
      assertGeneratedFilesFlake8(appTree, 'apps/test');
      assertGeneratedFilesPyTest(appTree, 'apps/test');
      expect(appTree.read('pyproject.toml', 'utf-8')).toMatchSnapshot();
    });

    it('should run successfully with flake8 linter and pytest with html,xml coverage reports and threshold', async () => {
      await generator(appTree, {
        ...options,
        linter: 'flake8',
        unitTestRunner: 'pytest',
        codeCoverage: true,
        codeCoverageHtmlReport: true,
        codeCoverageXmlReport: true,
        codeCoverageThreshold: 100,
      });
      const config = readProjectConfiguration(appTree, 'test');
      expect(config).toMatchSnapshot();

      assertGeneratedFilesBase(appTree, 'apps/test', 'test');
      assertGeneratedFilesFlake8(appTree, 'apps/test');
      assertGeneratedFilesPyTest(appTree, 'apps/test');
      expect(appTree.read('pyproject.toml', 'utf-8')).toMatchSnapshot();
    });

    it('should run successfully with flake8 linter and pytest with html,xml coverage reports, threshold and junit report', async () => {
      await generator(appTree, {
        ...options,
        linter: 'flake8',
        unitTestRunner: 'pytest',
        codeCoverage: true,
        codeCoverageHtmlReport: true,
        codeCoverageXmlReport: true,
        codeCoverageThreshold: 100,
        unitTestJUnitReport: true,
      });
      const config = readProjectConfiguration(appTree, 'test');
      expect(config).toMatchSnapshot();

      assertGeneratedFilesBase(appTree, 'apps/test', 'test');
      assertGeneratedFilesFlake8(appTree, 'apps/test');
      assertGeneratedFilesPyTest(appTree, 'apps/test');

      expect(appTree.read('pyproject.toml', 'utf-8')).toMatchSnapshot();
    });

    it('should run successfully with flake8 linter and pytest with html,xml coverage reports, threshold and junit,html report', async () => {
      await generator(appTree, {
        ...options,
        linter: 'flake8',
        unitTestRunner: 'pytest',
        codeCoverage: true,
        codeCoverageHtmlReport: true,
        codeCoverageXmlReport: true,
        codeCoverageThreshold: 100,
        unitTestJUnitReport: true,
        unitTestHtmlReport: true,
      });
      const config = readProjectConfiguration(appTree, 'test');
      expect(config).toMatchSnapshot();

      assertGeneratedFilesBase(appTree, 'apps/test', 'test');
      assertGeneratedFilesFlake8(appTree, 'apps/test');
      assertGeneratedFilesPyTest(appTree, 'apps/test');

      expect(appTree.read('pyproject.toml', 'utf-8')).toMatchSnapshot();
    });

    it('should run successfully with linting (flake8) and testing options with a dev dependency project', async () => {
      await generator(appTree, {
        ...options,
        projectType: 'library',
        name: 'dev-lib',
        directory: 'shared',
      });

      await generator(appTree, {
        ...options,
        linter: 'flake8',
        unitTestRunner: 'pytest',
        codeCoverage: true,
        codeCoverageHtmlReport: true,
        codeCoverageXmlReport: true,
        codeCoverageThreshold: 100,
        unitTestJUnitReport: true,
        unitTestHtmlReport: true,
        devDependenciesProject: 'shared-dev-lib',
      });

      const config = readProjectConfiguration(appTree, 'test');
      expect(config).toMatchSnapshot();

      assertGeneratedFilesBase(appTree, 'apps/test', 'test');
      assertGeneratedFilesFlake8(appTree, 'apps/test');
      assertGeneratedFilesPyTest(appTree, 'apps/test');

      assertGeneratedFilesBase(
        appTree,
        'libs/shared/dev-lib',
        'shared_dev_lib',
      );

      expect(appTree.read('pyproject.toml', 'utf-8')).toMatchSnapshot();
    });

    it('should run successfully with linting (ruff) and testing options with a dev dependency project', async () => {
      await generator(appTree, {
        ...options,
        projectType: 'library',
        name: 'dev-lib',
        directory: 'shared',
      });

      await generator(appTree, {
        ...options,
        linter: 'ruff',
        unitTestRunner: 'pytest',
        codeCoverage: true,
        codeCoverageHtmlReport: true,
        codeCoverageXmlReport: true,
        codeCoverageThreshold: 100,
        unitTestJUnitReport: true,
        unitTestHtmlReport: true,
        devDependenciesProject: 'shared-dev-lib',
      });

      const config = readProjectConfiguration(appTree, 'test');
      expect(config).toMatchSnapshot();

      assertGeneratedFilesBase(appTree, 'apps/test', 'test');
      assertGeneratedFilesPyTest(appTree, 'apps/test');

      assertGeneratedFilesBase(
        appTree,
        'libs/shared/dev-lib',
        'shared_dev_lib',
      );

      expect(appTree.read('pyproject.toml', 'utf-8')).toMatchSnapshot();
    });

    it('should run successfully with linting and testing options with a dev dependency project with custom package name', async () => {
      await generator(appTree, {
        ...options,
        projectType: 'library',
        name: 'dev-lib',
        directory: 'shared',
        packageName: 'custom-shared-dev-lib',
      });

      await generator(appTree, {
        ...options,
        linter: 'flake8',
        unitTestRunner: 'pytest',
        codeCoverage: true,
        codeCoverageHtmlReport: true,
        codeCoverageXmlReport: true,
        codeCoverageThreshold: 100,
        unitTestJUnitReport: true,
        unitTestHtmlReport: true,
        devDependenciesProject: 'shared-dev-lib',
      });

      expect(appTree.exists(`apps/test/pyproject.toml`)).toBeTruthy();
      expect(
        appTree.read(`apps/test/pyproject.toml`, 'utf8'),
      ).toMatchSnapshot();
      expect(appTree.read('pyproject.toml', 'utf-8')).toMatchSnapshot();
    });

    it('should run successfully with linting and testing options with an existing dev dependency project', async () => {
      await generator(appTree, {
        ...options,
        projectType: 'library',
        name: 'dev-lib',
        directory: 'shared',
      });

      const pyprojectToml = parse(
        appTree.read('libs/shared/dev-lib/pyproject.toml', 'utf-8'),
      ) as UVPyprojectToml;

      pyprojectToml.project.dependencies = [
        'autopep8>=1.0.0',
        'pytest>=1.0.0',
        'pytest-sugar=>1.0.0',
        'pytest-cov=>1.0.0',
        'pytest-html=>1.0.0',
        'flake8=>1.0.0',
        'flake8-isort=>1.0.0',
      ];

      appTree.write(
        'libs/shared/dev-lib/pyproject.toml',
        stringify(pyprojectToml),
      );

      await generator(appTree, {
        ...options,
        linter: 'flake8',
        unitTestRunner: 'pytest',
        codeCoverage: true,
        codeCoverageHtmlReport: true,
        codeCoverageXmlReport: true,
        codeCoverageThreshold: 100,
        unitTestJUnitReport: true,
        unitTestHtmlReport: true,
        devDependenciesProject: 'shared-dev-lib',
      });

      const config = readProjectConfiguration(appTree, 'test');
      expect(config).toMatchSnapshot();

      assertGeneratedFilesBase(appTree, 'apps/test', 'test');
      assertGeneratedFilesFlake8(appTree, 'apps/test');
      assertGeneratedFilesPyTest(appTree, 'apps/test');

      assertGeneratedFilesBase(
        appTree,
        'libs/shared/dev-lib',
        'shared_dev_lib',
      );
    });

    it('should run successfully with ruff linter, pytest, uv build system and src directory', async () => {
      await generator(appTree, {
        ...options,
        linter: 'ruff',
        unitTestRunner: 'pytest',
        codeCoverage: true,
        codeCoverageHtmlReport: true,
        codeCoverageXmlReport: true,
        codeCoverageThreshold: 100,
        unitTestJUnitReport: true,
        unitTestHtmlReport: true,
        buildSystem: 'uv',
        srcDir: true,
      });
      const config = readProjectConfiguration(appTree, 'test');
      expect(config).toMatchSnapshot();

      assertGeneratedFilesBase(appTree, 'apps/test', 'test', true);
      assertGeneratedFilesPyTest(appTree, 'apps/test');
      expect(appTree.read('pyproject.toml', 'utf-8')).toMatchSnapshot();
    });
  });

  describe('workspace', () => {
    it('should run successfully with minimal options with existing custom rootPyprojectDependencyGroup', async () => {
      appTree.write(
        'pyproject.toml',
        dedent`
        [project]
        name = "nx-workspace"
        version = "1.0.0"
        dependencies = [ ]

        [dependency-groups]
        dev = [ "requests>=2.3.1" ]
        `,
      );

      const callbackTask = await generator(appTree, {
        ...options,
        rootPyprojectDependencyGroup: 'dev',
      });
      await callbackTask();
      const config = readProjectConfiguration(appTree, 'test');
      expect(config).toMatchSnapshot();

      const projectDirectory = 'apps/test';
      const moduleName = 'test';

      assertGeneratedFilesBase(appTree, projectDirectory, moduleName);

      expect(appTree.exists(`${projectDirectory}/.flake8`)).toBeFalsy();
      expect(
        appTree.exists(`${projectDirectory}/tests/test_hello.py`),
      ).toBeFalsy();

      expect(appTree.read('pyproject.toml', 'utf-8')).toMatchSnapshot();

      expect(spawn.sync).toHaveBeenCalledTimes(2);
      expect(spawn.sync).toHaveBeenNthCalledWith(1, 'python', ['--version'], {
        stdio: 'pipe',
      });
      expect(spawn.sync).toHaveBeenNthCalledWith(2, 'uv', ['sync'], {
        shell: false,
        stdio: 'inherit',
      });
    });

    it('should run successfully with minimal options without rootPyprojectDependencyGroup', async () => {
      appTree.write(
        'pyproject.toml',
        dedent`
        [project]
        name = "nx-workspace"
        version = "1.0.0"
        dependencies = [ ]
        `,
      );

      const callbackTask = await generator(appTree, {
        ...options,
        rootPyprojectDependencyGroup: undefined,
      });
      await callbackTask();
      const config = readProjectConfiguration(appTree, 'test');
      expect(config).toMatchSnapshot();

      const projectDirectory = 'apps/test';
      const moduleName = 'test';

      assertGeneratedFilesBase(appTree, projectDirectory, moduleName);

      expect(appTree.exists(`${projectDirectory}/.flake8`)).toBeFalsy();
      expect(
        appTree.exists(`${projectDirectory}/tests/test_hello.py`),
      ).toBeFalsy();

      expect(appTree.read('pyproject.toml', 'utf-8')).toMatchSnapshot();

      expect(spawn.sync).toHaveBeenCalledTimes(2);
      expect(spawn.sync).toHaveBeenNthCalledWith(1, 'python', ['--version'], {
        stdio: 'pipe',
      });
      expect(spawn.sync).toHaveBeenNthCalledWith(2, 'uv', ['sync'], {
        shell: false,
        stdio: 'inherit',
      });
    });

    it('should run successfully with minimal options with custom rootPyprojectDependencyGroup', async () => {
      appTree.write(
        'pyproject.toml',
        dedent`
        [project]
        name = "nx-workspace"
        version = "1.0.0"
        dependencies = [ ]
        `,
      );

      const callbackTask = await generator(appTree, {
        ...options,
        rootPyprojectDependencyGroup: 'dev',
      });
      await callbackTask();
      const config = readProjectConfiguration(appTree, 'test');
      expect(config).toMatchSnapshot();

      const projectDirectory = 'apps/test';
      const moduleName = 'test';

      assertGeneratedFilesBase(appTree, projectDirectory, moduleName);

      expect(appTree.exists(`${projectDirectory}/.flake8`)).toBeFalsy();
      expect(
        appTree.exists(`${projectDirectory}/tests/test_hello.py`),
      ).toBeFalsy();

      expect(appTree.read('pyproject.toml', 'utf-8')).toMatchSnapshot();

      expect(spawn.sync).toHaveBeenCalledTimes(2);
      expect(spawn.sync).toHaveBeenNthCalledWith(1, 'python', ['--version'], {
        stdio: 'pipe',
      });
      expect(spawn.sync).toHaveBeenNthCalledWith(2, 'uv', ['sync'], {
        shell: false,
        stdio: 'inherit',
      });
    });

    it('should preserve sorted order in root pyproject.toml', async () => {
      appTree.write(
        'pyproject.toml',
        dedent`
        [project]
        name = "nx-workspace"
        version = "1.0.0"
        dependencies = [ "aardvark", "zebra" ]

        [tool.uv.sources.aardvark]
        workspace = true

        [tool.uv.sources.zebra]
        workspace = true

        [tool.uv.workspace]
        members = [ "apps/aardvark", "libs/zebra" ]

        [dependency-groups]
        dev = [ "autopep8>=2.3.1" ]

        `,
      );

      const callbackTask = await generator(appTree, {
        name: 'test',
        projectType: 'application',
        rootPyprojectDependencyGroup: 'main',
        ...options,
      });
      await callbackTask();

      expect(appTree.read('pyproject.toml').toString()).toEqual(
        dedent`
        [project]
        name = "nx-workspace"
        version = "1.0.0"
        dependencies = [ "aardvark", "test", "zebra" ]

        [tool.uv.sources.aardvark]
        workspace = true

        [tool.uv.sources.test]
        workspace = true

        [tool.uv.sources.zebra]
        workspace = true

        [tool.uv.workspace]
        members = [ "apps/aardvark", "apps/test", "libs/zebra" ]

        [dependency-groups]
        dev = [ "autopep8>=2.3.1" ]

        `,
      );
    });
  });

  describe('custom template dir', () => {
    it('should run successfully with custom template dir', async () => {
      await generator(appTree, {
        ...options,
        templateDir: path.join(__dirname, '__test__/custom-template'),
      });
      const config = readProjectConfiguration(appTree, 'test');
      expect(config).toMatchSnapshot();

      expect(
        appTree.read('apps/test/pyproject.toml', 'utf-8'),
      ).toMatchSnapshot();

      expect(appTree.read('apps/test/poetry.toml', 'utf-8')).toMatchSnapshot();
    });
  });
});

function assertGeneratedFilesBase(
  appTree: Tree,
  projectDirectory: string,
  moduleName: string,
  srcDir = false,
) {
  expect(appTree.exists(`${projectDirectory}/README.md`)).toBeTruthy();
  expect(
    appTree.read(`${projectDirectory}/README.md`, 'utf8'),
  ).toMatchSnapshot();

  expect(appTree.exists(`${projectDirectory}/pyproject.toml`)).toBeTruthy();
  expect(
    appTree.read(`${projectDirectory}/pyproject.toml`, 'utf8'),
  ).toMatchSnapshot();

  if (srcDir) {
    expect(appTree.exists(`${projectDirectory}/src`)).toBeTruthy();
    expect(
      appTree.exists(`${projectDirectory}/src/${moduleName}`),
    ).toBeTruthy();
    expect(
      appTree.read(`${projectDirectory}/src/${moduleName}/hello.py`, 'utf-8'),
    ).toMatchSnapshot();
  } else {
    expect(
      appTree.exists(`${projectDirectory}/${moduleName}/hello.py`),
    ).toBeTruthy();

    expect(
      appTree.read(`${projectDirectory}/${moduleName}/hello.py`, 'utf-8'),
    ).toMatchSnapshot();
  }

  expect(
    appTree.read(`${projectDirectory}/.python-version`, 'utf-8'),
  ).toMatchSnapshot();
}

function assertGeneratedFilesFlake8(appTree: Tree, projectDirectory: string) {
  expect(appTree.exists(`${projectDirectory}/.flake8`)).toBeTruthy();
  expect(
    appTree.read(`${projectDirectory}/.flake8`, 'utf-8'),
  ).toMatchSnapshot();
}

function assertGeneratedFilesPyTest(appTree: Tree, projectDirectory: string) {
  expect(
    appTree.exists(`${projectDirectory}/tests/test_hello.py`),
  ).toBeTruthy();

  expect(
    appTree.read(`${projectDirectory}/tests/test_hello.py`, 'utf-8'),
  ).toMatchSnapshot();
}
