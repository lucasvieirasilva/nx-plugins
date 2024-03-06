import { vi, MockInstance } from 'vitest';
import { BuildExecutorSchema } from './schema';
import '../../utils/mocks/cross-spawn.mock';
import { uuidMock } from '../../utils/mocks/uuid.mock';
import * as poetryUtils from '../utils/poetry';
import executor from './executor';
import fsMock from 'mock-fs';
import { existsSync, readFileSync, mkdirsSync, writeFileSync } from 'fs-extra';
import { parse } from '@iarna/toml';
import { join } from 'path';
import { tmpdir } from 'os';
import chalk from 'chalk';
import { PyprojectToml } from '../../graph/dependency-graph';
import dedent from 'string-dedent';
import spawn from 'cross-spawn';
import { SpawnSyncOptions } from 'child_process';

describe('Build Executor', () => {
  let buildPath = null;
  let checkPoetryExecutableMock: MockInstance;
  let activateVenvMock: MockInstance;

  beforeAll(() => {
    console.log(chalk`init chalk`);
  });

  beforeEach(() => {
    uuidMock.mockReturnValue('abc');
    buildPath = join(tmpdir(), 'nx-python', 'build', 'abc');

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

  afterEach(() => {
    fsMock.restore();
    vi.resetAllMocks();
  });

  it('should return success false when the poetry is not installed', async () => {
    checkPoetryExecutableMock.mockRejectedValue(new Error('poetry not found'));

    const options = {
      ignorePaths: ['.venv', '.tox', 'tests/'],
      silent: false,
      outputPath: 'dist/apps/app',
      keepBuildFolder: true,
      devDependencies: false,
      lockedVersions: true,
      bundleLocalDependencies: true,
    };

    const context = {
      cwd: '',
      root: '.',
      isVerbose: false,
      projectName: 'app',
      workspace: {
        npmScope: 'nxlv',
        version: 2,
        projects: {
          app: {
            root: 'apps/app',
            targets: {},
          },
        },
      },
    };

    const output = await executor(options, context);
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    expect(activateVenvMock).toHaveBeenCalledWith('.');
    expect(spawn.sync).not.toHaveBeenCalled();
    expect(output.success).toBe(false);
  });

  it('should throw an error when the lockedVersion is set to true and bundleLocalDependencies to false', async () => {
    checkPoetryExecutableMock.mockResolvedValue(undefined);

    const options = {
      ignorePaths: ['.venv', '.tox', 'tests/'],
      silent: false,
      outputPath: 'dist/apps/app',
      keepBuildFolder: true,
      devDependencies: false,
      lockedVersions: true,
      bundleLocalDependencies: false,
    };

    const context = {
      cwd: '',
      root: '.',
      isVerbose: false,
      projectName: 'app',
      workspace: {
        npmScope: 'nxlv',
        version: 2,
        projects: {
          app: {
            root: 'apps/app',
            targets: {},
          },
        },
      },
    };

    const output = await executor(options, context);
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    expect(activateVenvMock).toHaveBeenCalledWith('.');
    expect(spawn.sync).not.toHaveBeenCalled();
    expect(output.success).toBe(false);
  });

  describe('locked resolver', () => {
    it('should build python project with local dependencies and keep the build folder', async () => {
      fsMock({
        'apps/app/.venv/pyvenv.cfg': 'fake',
        'apps/app/app/index.py': 'print("Hello from app")',
        'apps/app/poetry.lock': dedent`
        [[package]]
        name = "click"
        version = "7.1.2"
        description = "Composable command line interface toolkit"
        category = "main"
        optional = false
        python-versions = ">=2.7, !=3.0.*, !=3.1.*, !=3.2.*, !=3.3.*, !=3.4.*"

        [[package]]
        name = "dep1"
        version = "1.0.0"
        description = "Dep1"
        category = "main"
        optional = false
          python-versions = "^3.8"
        develop = false

        [package.dependencies]
        numpy = "1.21.0"

        [package.source]
        type = "directory"
        url = "../../libs/dep1"

        [[package]]
        name = "numpy"
        version = "1.21.0"
        description = "NumPy is the fundamental package for array computing with Python."
        category = "main"
        optional = false
        python-versions = ">=3.7"
        `,

        'apps/app/pyproject.toml': dedent`
        [tool.poetry]
        name = "app"
        version = "1.0.0"
          [[tool.poetry.packages]]
          include = "app"

          [tool.poetry.dependencies]
          python = "^3.8"
          click = "7.1.2"
          dep1 = { path = "../../libs/dep1" }

          [tool.poetry.group.dev.dependencies]
          pytest = "6.2.4"
        `,

        'libs/dep1/dep1/index.py': 'print("Hello from dep1")',
        'libs/dep1/pyproject.toml': dedent`
        [tool.poetry]
        name = "dep1"
        version = "1.0.0"
          [[tool.poetry.packages]]
          include = "dep1"

          [tool.poetry.dependencies]
          python = "^3.8"
          numpy = "1.21.0"

          [tool.poetry.group.dev.dependencies]
          pytest = "6.2.4"
        `,

        'libs/dep2/dep2/index.py': 'print("Hello from dep2")',
        'libs/dep2/pyproject.toml': dedent`
        [tool.poetry]
        name = "dep2"
        version = "1.0.0"
          [[tool.poetry.packages]]
          include = "dep2"

          [tool.poetry.dependencies]
          python = "^3.8"

          [tool.poetry.group.dev.dependencies]
          pytest = "6.2.4"
        `,
      });

      vi.mocked(spawn.sync).mockImplementation((_, args, opts) => {
        if (args[0] == 'build') {
          spawnBuildMockImpl(opts);
        } else if (args[0] == 'export' && opts.cwd === 'apps/app') {
          writeFileSync(
            join(buildPath, 'requirements.txt'),
            dedent`
            click==7.1.2
            dep1 @ file://${process.cwd()}/libs/dep1
            numpy==1.21.0; python_version >= "3.8" and python_version < "4.0"

          `,
          );
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

      const options: BuildExecutorSchema = {
        ignorePaths: ['.venv', '.tox', 'tests/'],
        silent: false,
        outputPath: 'dist/apps/app',
        keepBuildFolder: true,
        devDependencies: false,
        lockedVersions: true,
        bundleLocalDependencies: true,
      };

      const output = await executor(options, {
        cwd: '',
        root: '.',
        isVerbose: false,
        projectName: 'app',
        workspace: {
          version: 2,
          projects: {
            app: {
              root: 'apps/app',
              targets: {},
            },
            dep1: {
              root: 'libs/dep1',
              targets: {},
            },
            dep2: {
              root: 'libs/dep2',
              targets: {},
            },
          },
        },
      });

      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.');
      expect(existsSync(buildPath)).toBeTruthy();
      expect(existsSync(`${buildPath}/app`)).toBeTruthy();
      expect(existsSync(`${buildPath}/dep1`)).toBeTruthy();
      expect(existsSync(`${buildPath}/dist/app.fake`)).toBeTruthy();
      expect(spawn.sync).toHaveBeenCalledWith('poetry', ['build'], {
        cwd: buildPath,
        shell: false,
        stdio: 'inherit',
      });

      const projectTomlData = parse(
        readFileSync(`${buildPath}/pyproject.toml`).toString('utf-8'),
      ) as PyprojectToml;

      expect(projectTomlData.tool.poetry.packages).toStrictEqual([
        {
          include: 'app',
        },
        {
          include: 'dep1',
        },
      ]);

      expect(projectTomlData.tool.poetry.dependencies).toStrictEqual({
        python: '^3.8',
        click: '7.1.2',
        numpy: {
          version: '1.21.0',
          optional: false,
          markers: 'python_version >= "3.8" and python_version < "4.0"',
        },
      });
      expect(projectTomlData.tool.poetry.group.dev.dependencies).toStrictEqual(
        {},
      );

      expect(output.success).toBe(true);
    });

    it('should build python project with git dependency with revision and markers', async () => {
      fsMock({
        'apps/app/.venv/pyvenv.cfg': 'fake',
        'apps/app/app/index.py': 'print("Hello from app")',
        'apps/app/poetry.lock': dedent`
        [[package]]
        name = "Django"
        version = "5.0.dev20230117182751"
        description = "A high-level Python web framework that encourages rapid development and clean, pragmatic design."
        category = "main"
        optional = false
        python-versions = ">=3.8"
        files = []
        develop = false

        [package.source]
        type = "git"
        url = "https://github.com/django/django.git"
        reference = "d54717118360e8679aa2bd0c5a1625f3e84712ba"
        resolved_reference = "d54717118360e8679aa2bd0c5a1625f3e84712ba"
        `,

        'apps/app/pyproject.toml': dedent`
        [tool.poetry]
        name = "app"
        version = "1.0.0"
          [[tool.poetry.packages]]
          include = "app"

          [tool.poetry.dependencies]
          python = "^3.8"
          django = {git = "https://github.com/django/django.git", rev = "d54717118360e8679aa2bd0c5a1625f3e84712ba"}
        `,
      });

      vi.mocked(spawn.sync).mockImplementation((_, args, opts) => {
        if (args[0] == 'build') {
          spawnBuildMockImpl(opts);
        } else if (args[0] == 'export' && opts.cwd === 'apps/app') {
          writeFileSync(
            join(buildPath, 'requirements.txt'),
            dedent`
            django @ git+https://github.com/django/django.git@d54717118360e8679aa2bd0c5a1625f3e84712ba ; python_version >= "3.8" and python_version < "3.10"
          `,
          );
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

      const options: BuildExecutorSchema = {
        ignorePaths: ['.venv', '.tox', 'tests/'],
        silent: false,
        outputPath: 'dist/apps/app',
        keepBuildFolder: true,
        devDependencies: false,
        lockedVersions: true,
        bundleLocalDependencies: true,
      };

      const output = await executor(options, {
        cwd: '',
        root: '.',
        isVerbose: false,
        projectName: 'app',
        workspace: {
          version: 2,
          projects: {
            app: {
              root: 'apps/app',
              targets: {},
            },
          },
        },
      });

      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.');
      expect(existsSync(buildPath)).toBeTruthy();
      expect(existsSync(`${buildPath}/app`)).toBeTruthy();
      expect(spawn.sync).toHaveBeenCalledWith('poetry', ['build'], {
        cwd: buildPath,
        shell: false,
        stdio: 'inherit',
      });

      const projectTomlData = parse(
        readFileSync(`${buildPath}/pyproject.toml`).toString('utf-8'),
      ) as PyprojectToml;

      expect(projectTomlData.tool.poetry.packages).toStrictEqual([
        {
          include: 'app',
        },
      ]);

      expect(projectTomlData.tool.poetry.dependencies).toStrictEqual({
        python: '^3.8',
        django: {
          git: 'https://github.com/django/django.git',
          optional: false,
          rev: 'd54717118360e8679aa2bd0c5a1625f3e84712ba',
          markers: 'python_version >= "3.8" and python_version < "3.10"',
        },
      });
      expect(projectTomlData.tool.poetry.group.dev.dependencies).toStrictEqual(
        {},
      );

      expect(output.success).toBe(true);
    });

    it('should build python project with git dependency without revision and markers', async () => {
      fsMock({
        'apps/app/.venv/pyvenv.cfg': 'fake',
        'apps/app/app/index.py': 'print("Hello from app")',
        'apps/app/poetry.lock': dedent`
        [[package]]
        name = "Django"
        version = "5.0.dev20230117182751"
        description = "A high-level Python web framework that encourages rapid development and clean, pragmatic design."
        category = "main"
        optional = false
        python-versions = ">=3.8"
        files = []
        develop = false

        [package.source]
        type = "git"
        url = "https://github.com/django/django.git"
        reference = "HEAD"
        resolved_reference = "d54717118360e8679aa2bd0c5a1625f3e84712ba"
        `,

        'apps/app/pyproject.toml': dedent`
        [tool.poetry]
        name = "app"
        version = "1.0.0"
          [[tool.poetry.packages]]
          include = "app"

          [tool.poetry.dependencies]
          python = "^3.8"
          django = {git = "https://github.com/django/django.git", rev = "d54717118360e8679aa2bd0c5a1625f3e84712ba"}
        `,
      });

      vi.mocked(spawn.sync).mockImplementation((_, args, opts) => {
        if (args[0] == 'build') {
          spawnBuildMockImpl(opts);
        } else if (args[0] == 'export' && opts.cwd === 'apps/app') {
          writeFileSync(
            join(buildPath, 'requirements.txt'),
            dedent`
            django @ git+https://github.com/django/django.git"
          `,
          );
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

      const options: BuildExecutorSchema = {
        ignorePaths: ['.venv', '.tox', 'tests/'],
        silent: false,
        outputPath: 'dist/apps/app',
        keepBuildFolder: true,
        devDependencies: false,
        lockedVersions: true,
        bundleLocalDependencies: true,
      };

      const output = await executor(options, {
        cwd: '',
        root: '.',
        isVerbose: false,
        projectName: 'app',
        workspace: {
          version: 2,
          projects: {
            app: {
              root: 'apps/app',
              targets: {},
            },
          },
        },
      });

      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.');
      expect(existsSync(buildPath)).toBeTruthy();
      expect(existsSync(`${buildPath}/app`)).toBeTruthy();
      expect(spawn.sync).toHaveBeenCalledWith('poetry', ['build'], {
        cwd: buildPath,
        shell: false,
        stdio: 'inherit',
      });

      const projectTomlData = parse(
        readFileSync(`${buildPath}/pyproject.toml`).toString('utf-8'),
      ) as PyprojectToml;

      expect(projectTomlData.tool.poetry.packages).toStrictEqual([
        {
          include: 'app',
        },
      ]);

      expect(projectTomlData.tool.poetry.dependencies).toStrictEqual({
        python: '^3.8',
        django: {
          git: 'https://github.com/django/django.git',
          optional: false,
        },
      });
      expect(projectTomlData.tool.poetry.group.dev.dependencies).toStrictEqual(
        {},
      );

      expect(output.success).toBe(true);
    });

    it('should build python project with git dependency with extras', async () => {
      fsMock({
        'apps/app/.venv/pyvenv.cfg': 'fake',
        'apps/app/app/index.py': 'print("Hello from app")',
        'apps/app/poetry.lock': dedent`
        [[package]]
        name = "Django"
        version = "5.0.dev20230117182751"
        description = "A high-level Python web framework that encourages rapid development and clean, pragmatic design."
        category = "main"
        optional = false
        python-versions = ">=3.8"
        files = []
        develop = false

        [package.source]
        type = "git"
        url = "https://github.com/django/django.git"
        reference = "HEAD"
        resolved_reference = "d54717118360e8679aa2bd0c5a1625f3e84712ba"
        `,

        'apps/app/pyproject.toml': dedent`
        [tool.poetry]
        name = "app"
        version = "1.0.0"
          [[tool.poetry.packages]]
          include = "app"

          [tool.poetry.dependencies]
          python = "^3.8"
          django = {git = "https://github.com/django/django.git", rev = "d54717118360e8679aa2bd0c5a1625f3e84712ba", extras = ["argon2"]}
        `,
      });

      vi.mocked(spawn.sync).mockImplementation((_, args, opts) => {
        if (args[0] == 'build') {
          spawnBuildMockImpl(opts);
        } else if (args[0] == 'export' && opts.cwd === 'apps/app') {
          writeFileSync(
            join(buildPath, 'requirements.txt'),
            dedent`
            django[argon2] @ git+https://github.com/django/django.git"
          `,
          );
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

      const options: BuildExecutorSchema = {
        ignorePaths: ['.venv', '.tox', 'tests/'],
        silent: false,
        outputPath: 'dist/apps/app',
        keepBuildFolder: true,
        devDependencies: false,
        lockedVersions: true,
        bundleLocalDependencies: true,
      };

      const output = await executor(options, {
        cwd: '',
        root: '.',
        isVerbose: false,
        projectName: 'app',
        workspace: {
          version: 2,
          projects: {
            app: {
              root: 'apps/app',
              targets: {},
            },
          },
        },
      });

      expect(output.success).toBe(true);
      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.');
      expect(existsSync(buildPath)).toBeTruthy();
      expect(existsSync(`${buildPath}/app`)).toBeTruthy();
      expect(spawn.sync).toHaveBeenCalledWith('poetry', ['build'], {
        cwd: buildPath,
        shell: false,
        stdio: 'inherit',
      });

      const projectTomlData = parse(
        readFileSync(`${buildPath}/pyproject.toml`).toString('utf-8'),
      ) as PyprojectToml;

      expect(projectTomlData.tool.poetry.packages).toStrictEqual([
        {
          include: 'app',
        },
      ]);

      expect(projectTomlData.tool.poetry.dependencies).toStrictEqual({
        python: '^3.8',
        django: {
          git: 'https://github.com/django/django.git',
          optional: false,
          extras: ['argon2'],
        },
      });
      expect(projectTomlData.tool.poetry.group.dev.dependencies).toStrictEqual(
        {},
      );
    });

    it('should throw an exception when the source type is not supported', async () => {
      fsMock({
        'apps/app/.venv/pyvenv.cfg': 'fake',
        'apps/app/app/index.py': 'print("Hello from app")',
        'apps/app/poetry.lock': dedent`
        [[package]]
        name = "Django"
        version = "5.0.dev20230117182751"

        [package.source]
        type = "invalid"
        `,

        'apps/app/pyproject.toml': dedent`
        [tool.poetry]
        name = "app"
        version = "1.0.0"
          [[tool.poetry.packages]]
          include = "app"

          [tool.poetry.dependencies]
          python = "^3.8"
          django = {git = "https://github.com/django/django.git", rev = "d54717118360e8679aa2bd0c5a1625f3e84712ba"}
        `,
      });

      vi.mocked(spawn.sync).mockImplementation((_, args, opts) => {
        if (args[0] == 'build') {
          spawnBuildMockImpl(opts);
        } else if (args[0] == 'export' && opts.cwd === 'apps/app') {
          writeFileSync(
            join(buildPath, 'requirements.txt'),
            dedent`
            django @ git+https://github.com/django/django.git"
          `,
          );
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

      const options: BuildExecutorSchema = {
        ignorePaths: ['.venv', '.tox', 'tests/'],
        silent: false,
        outputPath: 'dist/apps/app',
        keepBuildFolder: true,
        devDependencies: false,
        lockedVersions: true,
        bundleLocalDependencies: true,
      };

      const output = await executor(options, {
        cwd: '',
        root: '.',
        isVerbose: false,
        projectName: 'app',
        workspace: {
          version: 2,
          projects: {
            app: {
              root: 'apps/app',
              targets: {},
            },
          },
        },
      });

      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.');
      expect(output.success).toBe(false);
    });

    it('should build python project with local dependencies with poetry plugins', async () => {
      fsMock({
        'apps/app/.venv/pyvenv.cfg': 'fake',
        'apps/app/app/index.py': 'print("Hello from app")',
        'apps/app/poetry.lock': dedent`
        [[package]]
        name = "click"
        version = "7.1.2"
        description = "Composable command line interface toolkit"
        category = "main"
        optional = false
        python-versions = ">=2.7, !=3.0.*, !=3.1.*, !=3.2.*, !=3.3.*, !=3.4.*"

        [[package]]
        name = "dep1"
        version = "1.0.0"
        description = "Dep1"
        category = "main"
        optional = false
          python-versions = "^3.8"
        develop = false

        [package.dependencies]
        numpy = "1.21.0"

        [package.source]
        type = "directory"
        url = "../../libs/dep1"

        [[package]]
        name = "numpy"
        version = "1.21.0"
        description = "NumPy is the fundamental package for array computing with Python."
        category = "main"
        optional = false
        python-versions = ">=3.7"
        `,
        'apps/app/pyproject.toml': dedent`
        [tool.poetry]
        name = "app"
        version = "1.0.0"
          [[tool.poetry.packages]]
          include = "app"

          [tool.poetry.dependencies]
          python = "^3.8"
          click = "7.1.2"
          dep1 = { path = "../../libs/dep1" }
        `,

        'libs/dep1/dep1/index.py': 'print("Hello from dep1")',
        'libs/dep1/pyproject.toml': dedent`
        [tool.poetry]
        name = "dep1"
        version = "1.0.0"

        [tool.poetry.plugins."test.a"]
        "test_a" = "dep1.index:TestA"
        "test_aa" = "dep1.index:TestAA"

        [tool.poetry.plugins."test.b"]
        "test_b" = "dep1.index:TestB"
        "test_bb" = "dep1.index:TestBB"

          [[tool.poetry.packages]]
          include = "dep1"

          [tool.poetry.dependencies]
          python = "^3.8"
          numpy = "1.21.0"
        `,

        'libs/dep2/dep2/index.py': 'print("Hello from dep2")',
        'libs/dep2/pyproject.toml': dedent`
        [tool.poetry]
        name = "dep2"
        version = "1.0.0"
          [[tool.poetry.packages]]
          include = "dep2"

          [tool.poetry.dependencies]
          python = "^3.8"
        `,
      });

      vi.mocked(spawn.sync).mockImplementation((_, args, opts) => {
        if (args[0] == 'build') {
          spawnBuildMockImpl(opts);
        } else if (args[0] == 'export' && opts.cwd === 'apps/app') {
          writeFileSync(
            join(buildPath, 'requirements.txt'),
            dedent`
              click==7.1.2
              dep1 @ file://${process.cwd()}/libs/dep1
              numpy==1.21.0; python_version >= "3.8" and python_version < "4.0"

            `,
          );
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

      const options: BuildExecutorSchema = {
        ignorePaths: ['.venv', '.tox', 'tests/'],
        silent: false,
        outputPath: 'dist/apps/app',
        keepBuildFolder: true,
        devDependencies: false,
        lockedVersions: true,
        bundleLocalDependencies: true,
      };

      const output = await executor(options, {
        cwd: '',
        root: '.',
        isVerbose: false,
        projectName: 'app',
        workspace: {
          version: 2,
          projects: {
            app: {
              root: 'apps/app',
              targets: {},
            },
            dep1: {
              root: 'libs/dep1',
              targets: {},
            },
            dep2: {
              root: 'libs/dep2',
              targets: {},
            },
          },
        },
      });

      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.');
      expect(existsSync(buildPath)).toBeTruthy();
      expect(existsSync(`${buildPath}/app`)).toBeTruthy();
      expect(existsSync(`${buildPath}/dep1`)).toBeTruthy();
      expect(existsSync(`${buildPath}/dist/app.fake`)).toBeTruthy();
      expect(spawn.sync).toHaveBeenCalledWith('poetry', ['build'], {
        cwd: buildPath,
        shell: false,
        stdio: 'inherit',
      });

      const projectTomlData = parse(
        readFileSync(`${buildPath}/pyproject.toml`).toString('utf-8'),
      ) as PyprojectToml;

      expect(projectTomlData.tool.poetry.packages).toStrictEqual([
        {
          include: 'app',
        },
        {
          include: 'dep1',
        },
      ]);

      expect(projectTomlData.tool.poetry.plugins).toStrictEqual({
        'test.a': { test_a: 'dep1.index:TestA', test_aa: 'dep1.index:TestAA' },
        'test.b': { test_b: 'dep1.index:TestB', test_bb: 'dep1.index:TestBB' },
      });

      expect(projectTomlData.tool.poetry.dependencies).toStrictEqual({
        python: '^3.8',
        click: '7.1.2',
        numpy: {
          version: '1.21.0',
          optional: false,
          markers: 'python_version >= "3.8" and python_version < "4.0"',
        },
      });
      expect(projectTomlData.tool.poetry.group.dev.dependencies).toStrictEqual(
        {},
      );

      expect(output.success).toBe(true);
    });

    it('should build python project with local dependencies that specify a "from" directory', async () => {
      fsMock({
        'apps/app/.venv/pyvenv.cfg': 'fake',
        'apps/app/app/index.py': 'print("Hello from app")',
        'apps/app/poetry.lock': dedent`
        [[package]]
        name = "dep1"
        version = "1.0.0"
        description = "Dep1"
        category = "main"
        optional = false
        python-versions = "^3.8"
        develop = false

        [package.source]
        type = "directory"
        url = "../../libs/dep1"
        `,
        'apps/app/pyproject.toml': dedent`
        [tool.poetry]
        name = "app"
        version = "1.0.0"
          [[tool.poetry.packages]]
          include = "app"

          [tool.poetry.dependencies]
          python = "^3.8"
          dep1 = { path = "../../libs/dep1" }
        `,

        'libs/dep1/src/dep1/index.py': 'print("Hello from dep1")',
        'libs/dep1/pyproject.toml': dedent`
        [tool.poetry]
        name = "dep1"
        version = "1.0.0"

          [[tool.poetry.packages]]
          include = "dep1"
          from = "src"

          [tool.poetry.dependencies]
          python = "^3.8"
        `,
      });

      vi.mocked(spawn.sync).mockImplementation((_, args, opts) => {
        if (args[0] == 'build') {
          spawnBuildMockImpl(opts);
        } else if (args[0] == 'export' && opts.cwd === 'apps/app') {
          writeFileSync(
            join(buildPath, 'requirements.txt'),
            dedent`
              dep1 @ file://${process.cwd()}/libs/dep1
            `,
          );
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

      const options: BuildExecutorSchema = {
        ignorePaths: ['.venv', '.tox', 'tests/'],
        silent: false,
        outputPath: 'dist/apps/app',
        keepBuildFolder: true,
        devDependencies: false,
        lockedVersions: true,
        bundleLocalDependencies: true,
      };

      const output = await executor(options, {
        cwd: '',
        root: '.',
        isVerbose: false,
        projectName: 'app',
        workspace: {
          version: 2,
          projects: {
            app: {
              root: 'apps/app',
              targets: {},
            },
            dep1: {
              root: 'libs/dep1',
              targets: {},
            },
          },
        },
      });

      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.');
      expect(existsSync(buildPath)).toBeTruthy();
      expect(existsSync(`${buildPath}/app`)).toBeTruthy();
      expect(existsSync(`${buildPath}/dep1`)).toBeTruthy();
      expect(existsSync(`${buildPath}/dist/app.fake`)).toBeTruthy();
      expect(spawn.sync).toHaveBeenCalledWith('poetry', ['build'], {
        cwd: buildPath,
        shell: false,
        stdio: 'inherit',
      });

      const projectTomlData = parse(
        readFileSync(`${buildPath}/pyproject.toml`).toString('utf-8'),
      ) as PyprojectToml;

      expect(projectTomlData.tool.poetry.packages).toStrictEqual([
        {
          include: 'app',
        },
        {
          include: 'dep1',
        },
      ]);

      expect(projectTomlData.tool.poetry.dependencies).toStrictEqual({
        python: '^3.8',
      });

      expect(projectTomlData.tool.poetry.group.dev.dependencies).toStrictEqual(
        {},
      );

      expect(output.success).toBe(true);
    });

    it('should build python project with local dependencies and extras', async () => {
      fsMock({
        'apps/app/.venv/pyvenv.cfg': 'fake',
        'apps/app/app/index.py': 'print("Hello from app")',
        'apps/app/poetry.lock': dedent`
        [[package]]
        name = "click"
        version = "7.1.2"
        description = "Composable command line interface toolkit"
        category = "main"
        optional = false
        python-versions = ">=2.7, !=3.0.*, !=3.1.*, !=3.2.*, !=3.3.*, !=3.4.*"

        [[package]]
        name = "pendulum"
        version = "2.1.2"
        description = "Python datetimes made easy"
        category = "main"
        optional = true
        python-versions = ">=2.7, !=3.0.*, !=3.1.*, !=3.2.*, !=3.3.*, !=3.4.*"

        [[package]]
        name = "dep1"
        version = "1.0.0"
        description = "Dep1"
        category = "main"
        optional = true
          python-versions = "^3.8"
        develop = false

        [package.dependencies]
        numpy = "1.21.0"

        [package.source]
        type = "directory"
        url = "../../libs/dep1"

        [[package]]
        name = "numpy"
        version = "1.21.0"
        description = "NumPy is the fundamental package for array computing with Python."
        category = "main"
        optional = true
        python-versions = ">=3.7"
        `,
        'apps/app/pyproject.toml': dedent`
        [tool.poetry]
        name = "app"
        version = "1.0.0"
          [[tool.poetry.packages]]
          include = "app"

          [tool.poetry.dependencies]
          python = "^3.8"
          click = "7.1.2"
          pendulum = { version = "2.1.2", optional = true }
          dep1 = { path = "../../libs/dep1", optional = true }

          [tool.poetry.extras]
          extra1 = ["pendulum", "dep1"]
        `,

        'libs/dep1/dep1/index.py': 'print("Hello from dep1")',
        'libs/dep1/pyproject.toml': dedent`
        [tool.poetry]
        name = "dep1"
        version = "1.0.0"

          [[tool.poetry.packages]]
          include = "dep1"

          [tool.poetry.dependencies]
          python = "^3.8"
          numpy = "1.21.0"
        `,
      });

      vi.mocked(spawn.sync).mockImplementation((_, args, opts) => {
        if (args[0] == 'build') {
          spawnBuildMockImpl(opts);
        } else if (args[0] == 'export' && opts.cwd === 'apps/app') {
          writeFileSync(
            join(buildPath, 'requirements.txt'),
            dedent`
              click==7.1.2
              pendulum==2.1.2
              dep1 @ file://${process.cwd()}/libs/dep1
              numpy==1.21.0; python_version >= "3.8" and python_version < "4.0"
            `,
          );
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

      const options: BuildExecutorSchema = {
        ignorePaths: ['.venv', '.tox', 'tests/'],
        silent: false,
        outputPath: 'dist/apps/app',
        keepBuildFolder: true,
        devDependencies: false,
        lockedVersions: true,
        bundleLocalDependencies: true,
      };

      const output = await executor(options, {
        cwd: '',
        root: '.',
        isVerbose: false,
        projectName: 'app',
        workspace: {
          version: 2,
          projects: {
            app: {
              root: 'apps/app',
              targets: {},
            },
            dep1: {
              root: 'libs/dep1',
              targets: {},
            },
          },
        },
      });

      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.');
      expect(output.success).toBe(true);
      expect(existsSync(buildPath)).toBeTruthy();
      expect(existsSync(`${buildPath}/app`)).toBeTruthy();
      expect(existsSync(`${buildPath}/dep1`)).toBeTruthy();
      expect(existsSync(`${buildPath}/dist/app.fake`)).toBeTruthy();
      expect(spawn.sync).toHaveBeenNthCalledWith(
        1,
        'poetry',
        [
          'export',
          '--format',
          'requirements.txt',
          '--without-hashes',
          '--without-urls',
          '--output',
          `${buildPath}/requirements.txt`,
          '--extras',
          'extra1',
        ],
        {
          cwd: 'apps/app',
          shell: false,
          stdio: 'inherit',
        },
      );
      expect(spawn.sync).toHaveBeenNthCalledWith(2, 'poetry', ['build'], {
        cwd: buildPath,
        shell: false,
        stdio: 'inherit',
      });

      const projectTomlData = parse(
        readFileSync(`${buildPath}/pyproject.toml`).toString('utf-8'),
      ) as PyprojectToml;

      expect(projectTomlData.tool.poetry.packages).toStrictEqual([
        {
          include: 'app',
        },
        {
          include: 'dep1',
        },
      ]);

      expect(projectTomlData.tool.poetry.dependencies).toStrictEqual({
        python: '^3.8',
        click: '7.1.2',
        numpy: {
          version: '1.21.0',
          optional: true,
          markers: 'python_version >= "3.8" and python_version < "4.0"',
        },
        pendulum: {
          optional: true,
          version: '2.1.2',
        },
      });

      expect(projectTomlData.tool.poetry.extras).toStrictEqual({
        extra1: ['pendulum', 'numpy'],
      });

      expect(projectTomlData.tool.poetry.group.dev.dependencies).toStrictEqual(
        {},
      );
    });

    it('should build python project with dependencies with extras', async () => {
      fsMock({
        'apps/app/.venv/pyvenv.cfg': 'fake',
        'apps/app/app/index.py': 'print("Hello from app")',
        'apps/app/poetry.lock': dedent`
        [[package]]
        name = "moto"
        version = "2.3.2"
        description = "A library that allows your python tests to easily mock out the boto library"
        category = "dev"
        optional = false
        python-versions = "*"
        `,
        'apps/app/pyproject.toml': dedent`
        [tool.poetry]
        name = "app"
        version = "1.0.0"
          [[tool.poetry.packages]]
          include = "app"

          [tool.poetry.dependencies]
          python = "^3.8"
          moto = {extras = ["s3", "sqs"], version = "2.3.2"}
        `,
      });

      vi.mocked(spawn.sync).mockImplementation((_, args, opts) => {
        if (args[0] == 'build') {
          spawnBuildMockImpl(opts);
        } else if (args[0] == 'export' && opts.cwd === 'apps/app') {
          writeFileSync(
            join(buildPath, 'requirements.txt'),
            dedent`
              moto[s3,sqs]==2.3.2
            `,
          );
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

      const options: BuildExecutorSchema = {
        ignorePaths: ['.venv', '.tox', 'tests/'],
        silent: false,
        outputPath: 'dist/apps/app',
        keepBuildFolder: true,
        devDependencies: false,
        lockedVersions: true,
        bundleLocalDependencies: true,
      };

      const output = await executor(options, {
        cwd: '',
        root: '.',
        isVerbose: false,
        projectName: 'app',
        workspace: {
          version: 2,
          projects: {
            app: {
              root: 'apps/app',
              targets: {},
            },
          },
        },
      });

      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.');
      expect(existsSync(buildPath)).toBeTruthy();
      expect(existsSync(`${buildPath}/app`)).toBeTruthy();
      expect(existsSync(`${buildPath}/dist/app.fake`)).toBeTruthy();
      expect(spawn.sync).toHaveBeenCalledWith('poetry', ['build'], {
        cwd: buildPath,
        shell: false,
        stdio: 'inherit',
      });

      const projectTomlData = parse(
        readFileSync(`${buildPath}/pyproject.toml`).toString('utf-8'),
      ) as PyprojectToml;
      expect(projectTomlData.tool.poetry.packages).toStrictEqual([
        {
          include: 'app',
        },
      ]);

      expect(projectTomlData.tool.poetry.dependencies).toStrictEqual({
        python: '^3.8',
        moto: {
          version: '2.3.2',
          optional: false,
          extras: ['s3', 'sqs'],
        },
      });
      expect(projectTomlData.tool.poetry.group.dev.dependencies).toStrictEqual(
        {},
      );
      expect(output.success).toBe(true);
    });

    it('should throw an exception when the package is not found in the poetry.lock', async () => {
      fsMock({
        'apps/app/.venv/pyvenv.cfg': 'fake',
        'apps/app/app/index.py': 'print("Hello from app")',
        'apps/app/poetry.lock': dedent`
        [[package]]
        name = "moto"
        version = "2.3.2"
        description = "A library that allows your python tests to easily mock out the boto library"
        category = "dev"
        optional = false
        python-versions = "*"
        `,
        'apps/app/pyproject.toml': dedent`
        [tool.poetry]
        name = "app"
        version = "1.0.0"
          [[tool.poetry.packages]]
          include = "app"

          [tool.poetry.dependencies]
          python = "^3.8"
          click = "7.1.2"
        `,
      });

      vi.mocked(spawn.sync).mockImplementation((_, args, opts) => {
        if (args[0] == 'build') {
          spawnBuildMockImpl(opts);
        } else if (args[0] == 'export' && opts.cwd === 'apps/app') {
          writeFileSync(join(buildPath, 'requirements.txt'), 'click==7.1.2');
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

      const options: BuildExecutorSchema = {
        ignorePaths: ['.venv', '.tox', 'tests/'],
        silent: false,
        outputPath: 'dist/apps/app',
        keepBuildFolder: false,
        devDependencies: false,
        lockedVersions: true,
        bundleLocalDependencies: true,
      };

      const output = await executor(options, {
        cwd: '',
        root: '.',
        isVerbose: false,
        projectName: 'app',
        workspace: {
          version: 2,
          projects: {
            app: {
              root: 'apps/app',
              targets: {},
            },
          },
        },
      });
      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.');
      expect(output.success).toBe(false);
    });

    it('should build python project with dependencies and delete the build folder', async () => {
      fsMock({
        'apps/app/.venv/pyvenv.cfg': 'fake',
        'apps/app/app/index.py': 'print("Hello from app")',
        'apps/app/poetry.lock': dedent`
        [[package]]
        name = "click"
        version = "7.1.2"
        description = "Composable command line interface toolkit"
        category = "main"
        optional = false
        python-versions = ">=2.7, !=3.0.*, !=3.1.*, !=3.2.*, !=3.3.*, !=3.4.*"
        `,

        'apps/app/pyproject.toml': dedent`
        [tool.poetry]
        name = "app"
        version = "1.0.0"
          [[tool.poetry.packages]]
          include = "app"

          [tool.poetry.dependencies]
          python = "^3.8"

          [tool.poetry.group.dev.dependencies]
          click = "7.1.2"
        `,
      });

      vi.mocked(spawn.sync).mockImplementation((_, args, opts) => {
        if (args[0] == 'build') {
          spawnBuildMockImpl(opts);
        } else if (args[0] == 'export' && opts.cwd === 'apps/app') {
          writeFileSync(join(buildPath, 'requirements.txt'), 'click==7.1.2');
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

      const options: BuildExecutorSchema = {
        ignorePaths: ['.venv', '.tox', 'tests/'],
        silent: false,
        outputPath: 'dist/apps/app',
        keepBuildFolder: false,
        devDependencies: true,
        lockedVersions: true,
        bundleLocalDependencies: true,
      };

      const output = await executor(options, {
        cwd: '',
        root: '.',
        isVerbose: false,
        projectName: 'app',
        workspace: {
          version: 2,
          projects: {
            app: {
              root: 'apps/app',
              targets: {},
            },
          },
        },
      });

      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.');
      expect(existsSync(buildPath)).not.toBeTruthy();
      expect(spawn.sync).toHaveBeenCalledWith('poetry', ['build'], {
        cwd: buildPath,
        shell: false,
        stdio: 'inherit',
      });
      expect(output.success).toBe(true);
    });

    it('should throw an exception when runs build', async () => {
      fsMock({
        'apps/app/.venv/pyvenv.cfg': 'fake',
        'apps/app/app/index.py': 'print("Hello from app")',
        'apps/app/pyproject.toml': dedent`
        [tool.poetry]
        name = "app"
        version = "1.0.0"
          [[tool.poetry.packages]]
          include = "app"

          [tool.poetry.dependencies]
          python = "^3.8"
          click = "7.1.2"
          dep1 = { path = "../../libs/dep1" }
        `,
      });

      vi.mocked(spawn.sync).mockImplementation((_, args, opts) => {
        if (args[0] == 'build') {
          spawnBuildMockImpl(opts);
        } else if (args[0] == 'export' && opts.cwd === 'apps/app') {
          throw Error('Poetry export error');
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

      const options: BuildExecutorSchema = {
        ignorePaths: ['.venv', '.tox', 'tests/'],
        silent: false,
        outputPath: 'dist/apps/app',
        keepBuildFolder: true,
        devDependencies: false,
        lockedVersions: true,
        bundleLocalDependencies: true,
      };

      const output = await executor(options, {
        cwd: '',
        root: '.',
        isVerbose: false,
        projectName: 'app',
        workspace: {
          version: 2,
          projects: {
            app: {
              root: 'apps/app',
              targets: {},
            },
          },
        },
      });

      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.');
      expect(output.success).toBe(false);
    });
  });

  describe('project resolver', () => {
    it('should throw an exception when the local dependency cannot be found on the workspace config', async () => {
      fsMock({
        'apps/app/.venv/pyvenv.cfg': 'fake',
        'apps/app/app/index.py': 'print("Hello from app")',
        'apps/app/pyproject.toml': dedent`
        [tool.poetry]
        name = "app"
        version = "1.0.0"
          [[tool.poetry.packages]]
          include = "app"

          [tool.poetry.dependencies]
          python = "^3.8"
          click = "^7.1.2"
          dep1 = { path = "../../libs/dep1" }

          [tool.poetry.group.dev.dependencies]
          pytest = "6.2.4"
        `,

        'apps/dep1/.venv/pyvenv.cfg': 'fake',
        'apps/dep1/dep1/index.py': 'print("Hello from app")',
        'libs/dep1/pyproject.toml': dedent`
        [tool.poetry]
        name = "dep1"
        version = "1.0.0"
          [[tool.poetry.packages]]
          include = "dep1"

          [tool.poetry.dependencies]
          python = "^3.8"
          numpy = "^1.21.0"

          [tool.poetry.group.dev.dependencies]
          pytest = "6.2.4"
        `,
      });

      vi.mocked(spawn.sync).mockImplementation((_, args, opts) => {
        spawnBuildMockImpl(opts);
        return {
          status: 0,
          output: [''],
          pid: 0,
          signal: null,
          stderr: null,
          stdout: null,
        };
      });

      const options: BuildExecutorSchema = {
        ignorePaths: ['.venv', '.tox', 'tests/'],
        silent: false,
        outputPath: 'dist/apps/app',
        keepBuildFolder: true,
        devDependencies: false,
        lockedVersions: false,
        bundleLocalDependencies: false,
      };

      const output = await executor(options, {
        cwd: '',
        root: '.',
        isVerbose: false,
        projectName: 'app',
        workspace: {
          version: 2,
          projects: {
            app: {
              root: 'apps/app',
              targets: {},
            },
          },
        },
      });

      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.');
      expect(output.success).toBe(false);
      expect(existsSync(buildPath)).toBeTruthy();
    });

    it('should build the project without locked versions and without bundle the local dependencies', async () => {
      fsMock({
        'apps/app/.venv/pyvenv.cfg': 'fake',
        'apps/app/app/index.py': 'print("Hello from app")',
        'apps/app/pyproject.toml': dedent`
        [tool.poetry]
        name = "app"
        version = "1.0.0"
          [[tool.poetry.packages]]
          include = "app"

          [tool.poetry.dependencies]
          python = "^3.8"
          click = "^7.1.2"
          dep1 = { path = "../../libs/dep1" }

          [tool.poetry.group.dev.dependencies]
          pytest = "6.2.4"
        `,

        'apps/dep1/.venv/pyvenv.cfg': 'fake',
        'apps/dep1/dep1/index.py': 'print("Hello from app")',
        'libs/dep1/pyproject.toml': dedent`
        [tool.poetry]
        name = "dep1"
        version = "1.0.0"
          [[tool.poetry.packages]]
          include = "dep1"

          [tool.poetry.dependencies]
          python = "^3.8"
          numpy = "^1.21.0"

          [tool.poetry.group.dev.dependencies]
          pytest = "6.2.4"
        `,
      });

      vi.mocked(spawn.sync).mockImplementation((_, args, opts) => {
        spawnBuildMockImpl(opts);
        return {
          status: 0,
          output: [''],
          pid: 0,
          signal: null,
          stderr: null,
          stdout: null,
        };
      });

      const options: BuildExecutorSchema = {
        ignorePaths: ['.venv', '.tox', 'tests/'],
        silent: false,
        outputPath: 'dist/apps/app',
        keepBuildFolder: true,
        devDependencies: false,
        lockedVersions: false,
        bundleLocalDependencies: false,
      };

      const output = await executor(options, {
        cwd: '',
        root: '.',
        isVerbose: false,
        projectName: 'app',
        workspace: {
          version: 2,
          projects: {
            app: {
              root: 'apps/app',
              targets: {},
            },
            dep1: {
              root: 'libs/dep1',
            },
          },
        },
      });

      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.');
      expect(output.success).toBe(true);
      expect(existsSync(buildPath)).toBeTruthy();
      expect(existsSync(`${buildPath}/app`)).toBeTruthy();
      expect(existsSync(`${buildPath}/dep1`)).not.toBeTruthy();
      expect(existsSync(`${buildPath}/dist/app.fake`)).toBeTruthy();
      expect(spawn.sync).toHaveBeenCalledWith('poetry', ['build'], {
        cwd: buildPath,
        shell: false,
        stdio: 'inherit',
      });

      const projectTomlData = parse(
        readFileSync(`${buildPath}/pyproject.toml`).toString('utf-8'),
      ) as PyprojectToml;

      expect(projectTomlData.tool.poetry.packages).toStrictEqual([
        {
          include: 'app',
        },
      ]);

      expect(projectTomlData.tool.poetry.dependencies).toStrictEqual({
        python: '^3.8',
        click: '^7.1.2',
        dep1: '1.0.0',
      });
      expect(projectTomlData.tool.poetry.group.dev.dependencies).toStrictEqual(
        {},
      );
    });

    it('should build the project without locked versions and bundle the local dependencies', async () => {
      fsMock({
        'apps/app/.venv/pyvenv.cfg': 'fake',
        'apps/app/app/index.py': 'print("Hello from app")',
        'apps/app/pyproject.toml': dedent`
        [tool.poetry]
        name = "app"
        version = "1.0.0"
          [[tool.poetry.packages]]
          include = "app"

          [tool.poetry.dependencies]
          python = "^3.8"
          click = "^7.1.2"
          dep1 = { path = "../../libs/dep1" }

          [tool.poetry.group.dev.dependencies]
          pytest = "6.2.4"
        `,

        'libs/dep1/.venv/pyvenv.cfg': 'fake',
        'libs/dep1/dep1/index.py': 'print("Hello from app")',
        'libs/dep1/pyproject.toml': dedent`
        [tool.poetry]
        name = "dep1"
        version = "1.0.0"
          [[tool.poetry.packages]]
          include = "dep1"

          [tool.poetry.dependencies]
          python = "^3.8"
          numpy = "^1.21.0"

          [tool.poetry.group.dev.dependencies]
          pytest = "6.2.4"
        `,
      });

      vi.mocked(spawn.sync).mockImplementation((_, args, opts) => {
        spawnBuildMockImpl(opts);
        return {
          status: 0,
          output: [''],
          pid: 0,
          signal: null,
          stderr: null,
          stdout: null,
        };
      });

      const options: BuildExecutorSchema = {
        ignorePaths: ['.venv', '.tox', 'tests/'],
        silent: false,
        outputPath: 'dist/apps/app',
        keepBuildFolder: true,
        devDependencies: false,
        lockedVersions: false,
        bundleLocalDependencies: false,
      };

      const output = await executor(options, {
        cwd: '',
        root: '.',
        isVerbose: false,
        projectName: 'app',
        workspace: {
          version: 2,
          projects: {
            app: {
              root: 'apps/app',
              targets: {},
            },
            dep1: {
              root: 'libs/dep1',
              targets: {
                build: {
                  options: {
                    publish: false,
                  },
                },
              },
            },
          },
        },
      });

      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.');
      expect(output.success).toBe(true);
      expect(existsSync(buildPath)).toBeTruthy();
      expect(existsSync(`${buildPath}/app`)).toBeTruthy();
      expect(existsSync(`${buildPath}/dep1`)).toBeTruthy();
      expect(existsSync(`${buildPath}/dist/app.fake`)).toBeTruthy();
      expect(spawn.sync).toHaveBeenCalledWith('poetry', ['build'], {
        cwd: buildPath,
        shell: false,
        stdio: 'inherit',
      });

      const projectTomlData = parse(
        readFileSync(`${buildPath}/pyproject.toml`).toString('utf-8'),
      ) as PyprojectToml;

      expect(projectTomlData.tool.poetry.packages).toStrictEqual([
        {
          include: 'app',
        },
        {
          include: 'dep1',
        },
      ]);

      expect(projectTomlData.tool.poetry.dependencies).toStrictEqual({
        python: '^3.8',
        click: '^7.1.2',
        numpy: '^1.21.0',
      });
      expect(projectTomlData.tool.poetry.group.dev.dependencies).toStrictEqual(
        {},
      );
    });

    it('should build the project without locked versions and bundle only local dependency and not the second level', async () => {
      fsMock({
        'apps/app/.venv/pyvenv.cfg': 'fake',
        'apps/app/app/index.py': 'print("Hello from app")',
        'apps/app/pyproject.toml': dedent`
        [tool.poetry]
        name = "app"
        version = "1.0.0"
          [[tool.poetry.packages]]
          include = "app"

          [tool.poetry.dependencies]
          python = "^3.8"
          click = "^7.1.2"
          dep1 = { path = "../../libs/dep1" }

          [tool.poetry.group.dev.dependencies]
          pytest = "6.2.4"
        `,

        'libs/dep1/.venv/pyvenv.cfg': 'fake',
        'libs/dep1/dep1/index.py': 'print("Hello from app")',
        'libs/dep1/pyproject.toml': dedent`
        [tool.poetry]
        name = "dep1"
        version = "1.0.0"
          [[tool.poetry.packages]]
          include = "dep1"

          [tool.poetry.dependencies]
          python = "^3.8"
          django = { version = "^4.1.5", extras = ["argon2"] }
          dep2 = { path = "../dep2" }

          [tool.poetry.group.dev.dependencies]
          pytest = "6.2.4"
        `,
        'libs/dep2/.venv/pyvenv.cfg': 'fake',
        'libs/dep2/dep2/index.py': 'print("Hello from app")',
        'libs/dep2/pyproject.toml': dedent`
        [tool.poetry]
        name = "dep2"
        version = "1.0.0"
          [[tool.poetry.packages]]
          include = "dep2"

          [tool.poetry.dependencies]
          python = "^3.8"
          numpy = "^1.21.0"

          [tool.poetry.group.dev.dependencies]
          pytest = "6.2.4"
        `,
      });

      vi.mocked(spawn.sync).mockImplementation((_, args, opts) => {
        spawnBuildMockImpl(opts);
        return {
          status: 0,
          output: [''],
          pid: 0,
          signal: null,
          stderr: null,
          stdout: null,
        };
      });

      const options: BuildExecutorSchema = {
        ignorePaths: ['.venv', '.tox', 'tests/'],
        silent: false,
        outputPath: 'dist/apps/app',
        keepBuildFolder: true,
        devDependencies: false,
        lockedVersions: false,
        bundleLocalDependencies: false,
      };

      const output = await executor(options, {
        cwd: '',
        root: '.',
        isVerbose: false,
        projectName: 'app',
        workspace: {
          version: 2,
          projects: {
            app: {
              root: 'apps/app',
              targets: {},
            },
            dep1: {
              root: 'libs/dep1',
              targets: {
                build: {
                  options: {
                    publish: false,
                  },
                },
              },
            },
            dep2: {
              root: 'libs/dep2',
              targets: {
                build: {
                  options: {
                    publish: true,
                    customSourceName: 'foo',
                    customSourceUrl: 'http://example.com/bar',
                  },
                },
              },
            },
          },
        },
      });

      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.');
      expect(output.success).toBe(true);
      expect(existsSync(buildPath)).toBeTruthy();
      expect(existsSync(`${buildPath}/app`)).toBeTruthy();
      expect(existsSync(`${buildPath}/dep1`)).toBeTruthy();
      expect(existsSync(`${buildPath}/dist/app.fake`)).toBeTruthy();
      expect(spawn.sync).toHaveBeenCalledWith('poetry', ['build'], {
        cwd: buildPath,
        shell: false,
        stdio: 'inherit',
      });

      const projectTomlData = parse(
        readFileSync(`${buildPath}/pyproject.toml`).toString('utf-8'),
      ) as PyprojectToml;

      expect(projectTomlData.tool.poetry.source).toStrictEqual([
        {
          name: 'foo',
          url: 'http://example.com/bar',
        },
      ]);

      expect(projectTomlData.tool.poetry.packages).toStrictEqual([
        {
          include: 'app',
        },
        {
          include: 'dep1',
        },
      ]);

      expect(projectTomlData.tool.poetry.dependencies).toStrictEqual({
        python: '^3.8',
        click: '^7.1.2',
        django: {
          version: '^4.1.5',
          extras: ['argon2'],
        },
        dep2: { version: '1.0.0', source: 'foo' },
      });
      expect(projectTomlData.tool.poetry.group.dev.dependencies).toStrictEqual(
        {},
      );
    });

    it('should build the project without locked versions and handle duplicate sources', async () => {
      fsMock({
        'apps/app/.venv/pyvenv.cfg': 'fake',
        'apps/app/app/index.py': 'print("Hello from app")',
        'apps/app/pyproject.toml': dedent`
        [tool.poetry]
        name = "app"
        version = "1.0.0"
          [[tool.poetry.packages]]
          include = "app"

          [tool.poetry.dependencies]
          python = "^3.8"
          click = "^7.1.2"
          dep1 = { path = "../../libs/dep1" }
          dep2 = { path = "../../libs/dep2" }
          dep3 = { path = "../../libs/dep3" }
          dep4 = { path = "../../libs/dep4" }
          dep5 = { path = "../../libs/dep5" }

          [tool.poetry.group.dev.dependencies]
          pytest = "6.2.4"
        `,

        'libs/dep1/.venv/pyvenv.cfg': 'fake',
        'libs/dep1/dep1/index.py': 'print("Hello from app")',
        'libs/dep1/pyproject.toml': dedent`
        [tool.poetry]
        name = "dep1"
        version = "1.0.0"
          [[tool.poetry.packages]]
          include = "dep1"

          [tool.poetry.dependencies]
          python = "^3.8"
          django = { version = "^4.1.5", extras = ["argon2"] }
          dep2 = { path = "../dep2" }

          [tool.poetry.group.dev.dependencies]
          pytest = "6.2.4"
        `,
        'libs/dep2/.venv/pyvenv.cfg': 'fake',
        'libs/dep2/dep2/index.py': 'print("Hello from app")',
        'libs/dep2/pyproject.toml': dedent`
        [tool.poetry]
        name = "dep2"
        version = "1.0.0"
          [[tool.poetry.packages]]
          include = "dep2"

          [tool.poetry.dependencies]
          python = "^3.8"
          numpy = "^1.21.0"

          [tool.poetry.group.dev.dependencies]
          pytest = "6.2.4"
        `,
        'libs/dep3/.venv/pyvenv.cfg': 'fake',
        'libs/dep3/dep3/index.py': 'print("Hello from app")',
        'libs/dep3/pyproject.toml': dedent`
        [tool.poetry]
        name = "dep3"
        version = "1.0.0"
          [[tool.poetry.packages]]
          include = "dep3"

          [tool.poetry.dependencies]
          python = "^3.8"
          numpy = "^1.21.0"

          [tool.poetry.group.dev.dependencies]
          pytest = "6.2.4"
        `,
        'libs/dep4/.venv/pyvenv.cfg': 'fake',
        'libs/dep4/dep4/index.py': 'print("Hello from app")',
        'libs/dep4/pyproject.toml': dedent`
        [tool.poetry]
        name = "dep4"
        version = "1.0.0"
          [[tool.poetry.packages]]
          include = "dep3"

          [tool.poetry.dependencies]
          python = "^3.8"
          numpy = "^1.21.0"

          [tool.poetry.group.dev.dependencies]
          pytest = "6.2.4"
        `,
        'libs/dep5/.venv/pyvenv.cfg': 'fake',
        'libs/dep5/dep5/index.py': 'print("Hello from app")',
        'libs/dep5/pyproject.toml': dedent`
        [tool.poetry]
        name = "dep5"
        version = "1.0.0"
          [[tool.poetry.packages]]
          include = "dep3"

          [tool.poetry.dependencies]
          python = "^3.8"
          numpy = "^1.21.0"

          [tool.poetry.group.dev.dependencies]
          pytest = "6.2.4"
        `,
      });

      vi.mocked(spawn.sync).mockImplementation((_, args, opts) => {
        spawnBuildMockImpl(opts);
        return {
          status: 0,
          output: [''],
          pid: 0,
          signal: null,
          stderr: null,
          stdout: null,
        };
      });

      const options: BuildExecutorSchema = {
        ignorePaths: ['.venv', '.tox', 'tests/'],
        silent: false,
        outputPath: 'dist/apps/app',
        keepBuildFolder: true,
        devDependencies: false,
        lockedVersions: false,
        bundleLocalDependencies: false,
      };

      const output = await executor(options, {
        cwd: '',
        root: '.',
        isVerbose: false,
        projectName: 'app',
        workspace: {
          version: 2,
          projects: {
            app: {
              root: 'apps/app',
              targets: {},
            },
            dep1: {
              root: 'libs/dep1',
              targets: {
                build: {
                  options: {
                    publish: true,
                    customSourceName: 'foo',
                    customSourceUrl: 'http://example.com/foo',
                  },
                },
              },
            },
            dep2: {
              root: 'libs/dep2',
              targets: {
                build: {
                  options: {
                    publish: true,
                    customSourceName: 'foo',
                    customSourceUrl: 'http://example.com/bar',
                  },
                },
              },
            },
            dep3: {
              root: 'libs/dep3',
              targets: {
                build: {
                  options: {
                    publish: true,
                    customSourceName: 'foo',
                    customSourceUrl: 'http://example.com/bar',
                  },
                },
              },
            },
            dep4: {
              root: 'libs/dep4',
              targets: {
                build: {
                  options: {
                    publish: true,
                    customSourceName: 'another',
                    customSourceUrl: 'http://example.com/another',
                  },
                },
              },
            },
            dep5: {
              root: 'libs/dep5',
              targets: {
                build: {
                  options: {
                    publish: true,
                    customSourceName: 'another',
                    customSourceUrl: 'http://example.com/another',
                  },
                },
              },
            },
          },
        },
      });

      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.');
      expect(output.success).toBe(true);
      expect(existsSync(buildPath)).toBeTruthy();
      expect(existsSync(`${buildPath}/app`)).toBeTruthy();
      expect(existsSync(`${buildPath}/dist/app.fake`)).toBeTruthy();
      expect(spawn.sync).toHaveBeenCalledWith('poetry', ['build'], {
        cwd: buildPath,
        shell: false,
        stdio: 'inherit',
      });

      const projectTomlData = parse(
        readFileSync(`${buildPath}/pyproject.toml`).toString('utf-8'),
      ) as PyprojectToml;

      expect(projectTomlData.tool.poetry.source).toStrictEqual([
        {
          name: 'foo',
          url: 'http://example.com/foo',
        },
        {
          name: 'foo-198fb9d8236b3d9116a180365e447b05',
          url: 'http://example.com/bar',
        },
        {
          name: 'another',
          url: 'http://example.com/another',
        },
      ]);

      expect(projectTomlData.tool.poetry.packages).toStrictEqual([
        {
          include: 'app',
        },
      ]);

      expect(projectTomlData.tool.poetry.dependencies).toStrictEqual({
        python: '^3.8',
        click: '^7.1.2',
        dep1: { version: '1.0.0', source: 'foo' },
        dep2: {
          version: '1.0.0',
          source: 'foo-198fb9d8236b3d9116a180365e447b05',
        },
        dep3: {
          version: '1.0.0',
          source: 'foo-198fb9d8236b3d9116a180365e447b05',
        },
        dep4: {
          version: '1.0.0',
          source: 'another',
        },
        dep5: {
          version: '1.0.0',
          source: 'another',
        },
      });
      expect(projectTomlData.tool.poetry.group.dev.dependencies).toStrictEqual(
        {},
      );
    });
  });
});

function spawnBuildMockImpl(opts: SpawnSyncOptions) {
  mkdirsSync(join(opts.cwd as string, 'dist'));
  writeFileSync(join(opts.cwd as string, 'dist', 'app.fake'), 'fake data');
}
