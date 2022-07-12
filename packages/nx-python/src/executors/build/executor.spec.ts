import { BuildExecutorSchema } from './schema';
import { spawnSyncMock } from '../../utils/mocks/child_process.mock';
import { uuidMock } from '../../utils/mocks/uuid.mock';
import executor from './executor';
import fsMock from 'mock-fs';
import { existsSync, readFileSync, mkdirsSync, writeFileSync } from 'fs-extra';
import { parse } from '@iarna/toml';
import { join } from 'path';
import { tmpdir } from 'os';
import chalk from 'chalk';
import { PyprojectToml } from '../../graph/dependency-graph';
import dedent from 'string-dedent';

describe('Build Executor', () => {
  let buildPath = null;

  beforeAll(() => {
    console.log(chalk`init chalk`);
  });

  beforeEach(() => {
    uuidMock.mockReturnValue('abc');
    buildPath = join(tmpdir(), 'nx-python', 'build', 'abc');
  });

  afterEach(() => {
    fsMock.restore();
    jest.resetAllMocks();
  });

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

    spawnSyncMock.mockImplementation((_, args, opts) => {
      if (args[0] == 'build') {
        spawnBuildMockImpl(opts);
      } else if (args[0] == 'export' && opts.cwd === 'apps/app') {
        writeFileSync(
          join(buildPath, 'requirements.txt'),
          dedent`
          click==7.1.2
          dep1 @ file://${process.cwd()}/libs/dep1
          numpy==1.21.0; python_version >= "3.8" and python_version < "4.0"

        `);
      }
    });

    const options: BuildExecutorSchema = {
      ignorePaths: ['.venv', '.tox', 'tests/'],
      silent: false,
      outputPath: 'dist/apps/app',
      keepBuildFolder: true,
      devDependencies: false,
    };

    const output = await executor(options, {
      cwd: '',
      root: '.',
      isVerbose: false,
      projectName: 'app',
      workspace: {
        version: 2,
        npmScope: 'nxlv',
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

    expect(existsSync(buildPath)).toBeTruthy();
    expect(existsSync(`${buildPath}/app`)).toBeTruthy();
    expect(existsSync(`${buildPath}/dep1`)).toBeTruthy();
    expect(existsSync(`${buildPath}/dist/app.fake`)).toBeTruthy();
    expect(spawnSyncMock).toHaveBeenCalledWith('poetry', ['build'], {
      cwd: buildPath,
      shell: false,
      stdio: 'inherit',
    });

    const projectTomlData = parse(
      readFileSync(`${buildPath}/pyproject.toml`).toString('utf-8')
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
    expect(projectTomlData.tool.poetry.group.dev.dependencies).toStrictEqual({});

    expect(output.success).toBe(true);
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

    spawnSyncMock.mockImplementation((_, args, opts) => {
      if (args[0] == 'build') {
        spawnBuildMockImpl(opts);
      } else if (args[0] == 'export' && opts.cwd === 'apps/app') {
        writeFileSync(
          join(buildPath, 'requirements.txt'),
          dedent`
            click==7.1.2
            dep1 @ file://${process.cwd()}/libs/dep1
            numpy==1.21.0; python_version >= "3.8" and python_version < "4.0"

          `
        )
      }
    });

    const options: BuildExecutorSchema = {
      ignorePaths: ['.venv', '.tox', 'tests/'],
      silent: false,
      outputPath: 'dist/apps/app',
      keepBuildFolder: true,
      devDependencies: false,
    };

    const output = await executor(options, {
      cwd: '',
      root: '.',
      isVerbose: false,
      projectName: 'app',
      workspace: {
        version: 2,
        npmScope: 'nxlv',
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

    expect(existsSync(buildPath)).toBeTruthy();
    expect(existsSync(`${buildPath}/app`)).toBeTruthy();
    expect(existsSync(`${buildPath}/dep1`)).toBeTruthy();
    expect(existsSync(`${buildPath}/dist/app.fake`)).toBeTruthy();
    expect(spawnSyncMock).toHaveBeenCalledWith('poetry', ['build'], {
      cwd: buildPath,
      shell: false,
      stdio: 'inherit',
    });

    const projectTomlData = parse(
      readFileSync(`${buildPath}/pyproject.toml`).toString('utf-8')
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
    expect(projectTomlData.tool.poetry.group.dev.dependencies).toStrictEqual({});

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

    spawnSyncMock.mockImplementation((_, args, opts) => {
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
        )
      }
    });

    const options: BuildExecutorSchema = {
      ignorePaths: ['.venv', '.tox', 'tests/'],
      silent: false,
      outputPath: 'dist/apps/app',
      keepBuildFolder: true,
      devDependencies: false,
    };

    const output = await executor(options, {
      cwd: '',
      root: '.',
      isVerbose: false,
      projectName: 'app',
      workspace: {
        version: 2,
        npmScope: 'nxlv',
        projects: {
          app: {
            root: 'apps/app',
            targets: {},
          },
          dep1: {
            root: 'libs/dep1',
            targets: {},
          }
        },
      },
    });

    expect(output.success).toBe(true);
    expect(existsSync(buildPath)).toBeTruthy();
    expect(existsSync(`${buildPath}/app`)).toBeTruthy();
    expect(existsSync(`${buildPath}/dep1`)).toBeTruthy();
    expect(existsSync(`${buildPath}/dist/app.fake`)).toBeTruthy();
    expect(spawnSyncMock).toHaveBeenNthCalledWith(1, 'poetry', [
      'export',
      '--format',
      'requirements.txt',
      '--without-hashes',
      '--without-urls',
      '--output',
      `${buildPath}/requirements.txt`,
      '--extras',
      'extra1'
    ], {
      cwd: "apps/app",
      shell: false,
      stdio: 'inherit',
    });
    expect(spawnSyncMock).toHaveBeenNthCalledWith(2, 'poetry', ['build'], {
      cwd: buildPath,
      shell: false,
      stdio: 'inherit',
    });

    const projectTomlData = parse(
      readFileSync(`${buildPath}/pyproject.toml`).toString('utf-8')
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
        version: "2.1.2",
      },
    });

    expect(projectTomlData.tool.poetry.extras).toStrictEqual({
      extra1: ['pendulum', 'numpy'],
    })

    expect(projectTomlData.tool.poetry.group.dev.dependencies).toStrictEqual({});
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

    spawnSyncMock.mockImplementation((_, args, opts) => {
      if (args[0] == 'build') {
        spawnBuildMockImpl(opts);
      } else if (args[0] == 'export' && opts.cwd === 'apps/app') {
        writeFileSync(
          join(buildPath, 'requirements.txt'),
          dedent`
            moto[s3,sqs]==2.3.2
          `,
        )
      }
    });

    const options: BuildExecutorSchema = {
      ignorePaths: ['.venv', '.tox', 'tests/'],
      silent: false,
      outputPath: 'dist/apps/app',
      keepBuildFolder: true,
      devDependencies: false,
    };

    const output = await executor(options, {
      cwd: '',
      root: '.',
      isVerbose: false,
      projectName: 'app',
      workspace: {
        version: 2,
        npmScope: 'nxlv',
        projects: {
          app: {
            root: 'apps/app',
            targets: {},
          },
        },
      },
    });

    expect(existsSync(buildPath)).toBeTruthy();
    expect(existsSync(`${buildPath}/app`)).toBeTruthy();
    expect(existsSync(`${buildPath}/dist/app.fake`)).toBeTruthy();
    expect(spawnSyncMock).toHaveBeenCalledWith('poetry', ['build'], {
      cwd: buildPath,
      shell: false,
      stdio: 'inherit',
    });

    const projectTomlData = parse(
      readFileSync(`${buildPath}/pyproject.toml`).toString('utf-8')
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
    expect(projectTomlData.tool.poetry.group.dev.dependencies).toStrictEqual({});
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

    spawnSyncMock.mockImplementation((_, args, opts) => {
      if (args[0] == 'build') {
        spawnBuildMockImpl(opts);
      } else if (args[0] == 'export' && opts.cwd === 'apps/app') {
        writeFileSync(
          join(buildPath, 'requirements.txt'), 'click==7.1.2'
        )
      }
    });

    const options: BuildExecutorSchema = {
      ignorePaths: ['.venv', '.tox', 'tests/'],
      silent: false,
      outputPath: 'dist/apps/app',
      keepBuildFolder: false,
      devDependencies: false,
    };

    const output = await executor(options, {
      cwd: '',
      root: '.',
      isVerbose: false,
      projectName: 'app',
      workspace: {
        version: 2,
        npmScope: 'nxlv',
        projects: {
          app: {
            root: 'apps/app',
            targets: {},
          },
        },
      },
    });
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

    spawnSyncMock.mockImplementation((_, args, opts) => {
      if (args[0] == 'build') {
        spawnBuildMockImpl(opts);
      } else if (args[0] == 'export' && opts.cwd === 'apps/app') {
        writeFileSync(
          join(buildPath, 'requirements.txt'), 'click==7.1.2'
        )
      }
    });

    const options: BuildExecutorSchema = {
      ignorePaths: ['.venv', '.tox', 'tests/'],
      silent: false,
      outputPath: 'dist/apps/app',
      keepBuildFolder: false,
      devDependencies: true,
    };

    const output = await executor(options, {
      cwd: '',
      root: '.',
      isVerbose: false,
      projectName: 'app',
      workspace: {
        version: 2,
        npmScope: 'nxlv',
        projects: {
          app: {
            root: 'apps/app',
            targets: {},
          },
        },
      },
    });

    expect(existsSync(buildPath)).not.toBeTruthy();
    expect(spawnSyncMock).toHaveBeenCalledWith('poetry', ['build'], {
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

    spawnSyncMock.mockImplementation((_, args, opts) => {
      if (args[0] == 'build') {
        spawnBuildMockImpl(opts);
      } else if (args[0] == 'export' && opts.cwd === 'apps/app') {
        throw Error('Poetry export error');
      }
    });

    const options: BuildExecutorSchema = {
      ignorePaths: ['.venv', '.tox', 'tests/'],
      silent: false,
      outputPath: 'dist/apps/app',
      keepBuildFolder: true,
      devDependencies: false,
    };

    const output = await executor(options, {
      cwd: '',
      root: '.',
      isVerbose: false,
      projectName: 'app',
      workspace: {
        version: 2,
        npmScope: 'nxlv',
        projects: {
          app: {
            root: 'apps/app',
            targets: {},
          },
        },
      },
    });

    expect(output.success).toBe(false);
  });
});

function spawnBuildMockImpl(opts: Record<string, string>) {
  mkdirsSync(join(opts.cwd, 'dist'));
  writeFileSync(join(opts.cwd, 'dist', 'app.fake'), 'fake data');
}
