import { BuildExecutorSchema } from './schema';
import { execSyncMock } from '../../utils/mocks/child_process.mock';
import { uuidMock } from '../../utils/mocks/uuid.mock';
import executor from './executor';
import fsMock from 'mock-fs';
import { existsSync, readFileSync, mkdirsSync, writeFileSync } from 'fs-extra';
import { parse } from '@iarna/toml';
import { join } from 'path';
import { tmpdir } from 'os';
import chalk from "chalk";

describe('Build Executor', () => {

  let buildPath = null

  beforeAll(() => {
    console.log(chalk`init chalk`)
  })

  beforeEach(() => {
    uuidMock.mockReturnValue('abc')
    buildPath = join(tmpdir(), 'nx-python', 'build', 'abc')

    execSyncMock.mockImplementation((command, opts) => {
      mkdirsSync(join(opts.cwd, 'dist'));
      writeFileSync(join(opts.cwd, 'dist', 'app.fake'), 'fake data');
    });
  })

  afterEach(() => {
    fsMock.restore();
    jest.resetAllMocks();
  });

  it('should build python project with dependencies and keep the build folder', async () => {
    fsMock({
      'apps/app/.venv/pyvenv.cfg': 'fake',
      'apps/app/app/index.py': 'print("Hello from app")',
      'apps/app/pyproject.toml': `[tool.poetry]
name = "app"
version = "1.0.0"
  [[tool.poetry.packages]]
  include = "app"

  [tool.poetry.dependencies]
  python = "^3.8"
  dep1 = { path = "../../libs/dep1" }`,
      'apps/app/poetry.lock': `[[package]]
name = "click"
version = "7.1.2"
description = "Composable command line interface toolkit"
category = "main"
optional = false
python-versions = ">=2.7, !=3.0.*, !=3.1.*, !=3.2.*, !=3.3.*, !=3.4.*"

[package.source]
type = "legacy"

[[package]]
name = "numpy"
version = "1.21.0"
description = "NumPy is the fundamental package for array computing with Python."
category = "main"
optional = false
python-versions = ">=3.7"

[package.source]
type = "legacy"

[[package]]
name = "python-dateutil"
version = "2.8.1"
description = "Extensions to the standard Python datetime module"
category = "main"
optional = false
python-versions = "!=3.0.*,!=3.1.*,!=3.2.*,>=2.7"

[package.source]
type = "legacy"

[[package]]
name = "dep1"
version = "1.0.0"
description = "Dep 1"
category = "main"
optional = false
  python-versions = "^3.8"
develop = false

[package.dependencies]
numpy = "1.21.0"
pandas = "1.2.5"

[package.source]
type = "directory"
url = "../../libs/dep1"`,

      'libs/dep1/dep1/index.py': 'print("Hello from dep1")',
      'libs/dep1/pyproject.toml': `[tool.poetry]
name = "dep1"
version = "1.0.0"
  [[tool.poetry.packages]]
  include = "dep1"

  [tool.poetry.dependencies]
  python = "^3.8"`,

      'libs/dep2/dep2/index.py': 'print("Hello from dep2")',
      'libs/dep2/pyproject.toml': `[tool.poetry]
name = "dep2"
version = "1.0.0"
  [[tool.poetry.packages]]
  include = "dep2"

  [tool.poetry.dependencies]
  python = "^3.8"`,
    });

    const options: BuildExecutorSchema = {
      ignorePaths: ['.venv', '.tox', 'tests/'],
      silent: false,
      outputPath: 'dist/apps/app',
      keepBuildFolder: true,
    };

    const output = await executor(options, {
      cwd: '',
      root: '',
      isVerbose: false,
      projectName: 'app',
      workspace: {
        version: 2,
        npmScope: '@lucasvieira',
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
    expect(execSyncMock).toHaveBeenCalledWith('poetry build', {
      cwd: buildPath,
      stdio: 'inherit'
    });

    const projectTomlData = parse(
      readFileSync(`${buildPath}/pyproject.toml`).toString('utf-8')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as any;

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
      numpy: '1.21.0',
      'python-dateutil': '2.8.1',
    });

    expect(output.success).toBe(true);
  });

  it('should not build python project when the poetry.lock not exist', async () => {
    fsMock({
      'apps/app/app/index.py': 'print("Hello from app")',
      'apps/app/pyproject.toml': `[tool.poetry]
name = "app"
version = "1.0.0"
  [[tool.poetry.packages]]
  include = "app"`,
    });

    const options: BuildExecutorSchema = {
      ignorePaths: ['.venv', '.tox', 'tests/'],
      silent: false,
      outputPath: 'dist/apps/app',
      keepBuildFolder: false,
    };

    const result = await executor(options, {
      cwd: '',
      root: '',
      isVerbose: false,
      projectName: 'app',
      workspace: {
        version: 2,
        npmScope: '@lucasvieira',
        projects: {
          app: {
            root: 'apps/app',
            targets: {},
          }
        },
      },
    })

    expect(result.success).toBe(false);
    expect(execSyncMock).not.toHaveBeenCalled();
    expect(existsSync('dist/apps/app/app.fake')).not.toBeTruthy();
    expect(execSyncMock).not.toHaveBeenCalled()
  });

  it('should build python project and delete the build folder', async () => {
    fsMock({
      'apps/app/app/index.py': 'print("Hello from app")',
      'apps/app/pyproject.toml': `[tool.poetry]
name = "app"
version = "1.0.0"
  [[tool.poetry.packages]]
  include = "app"

  [tool.poetry.dependencies]
  python = "^3.8"
  click = "click"`,
      'apps/app/poetry.lock': `[[package]]
name = "click"
version = "7.1.2"
description = "Composable command line interface toolkit"
category = "main"
optional = false
python-versions = ">=2.7, !=3.0.*, !=3.1.*, !=3.2.*, !=3.3.*, !=3.4.*"

[package.source]
type = "legacy"`,
    });

    const options: BuildExecutorSchema = {
      ignorePaths: ['.venv', '.tox', 'tests/'],
      silent: false,
      outputPath: 'dist/apps/app',
      keepBuildFolder: false,
    };

    const output = await executor(options, {
      cwd: '',
      root: '',
      isVerbose: false,
      projectName: 'app',
      workspace: {
        version: 2,
        npmScope: '@lucasvieira',
        projects: {
          app: {
            root: 'apps/app',
            targets: {},
          }
        },
      },
    });

    expect(existsSync(buildPath)).not.toBeTruthy();
    expect(existsSync('dist/apps/app/app.fake')).toBeTruthy();
    expect(execSyncMock).toHaveBeenCalledWith('poetry build', {
      cwd: buildPath,
      stdio: 'inherit'
    });
    expect(output.success).toBe(true);
  });

  it('should build python project without python dependencies', async () => {
    fsMock({
      'apps/app/app/index.py': 'print("Hello from app")',
      'apps/app/pyproject.toml': `[tool.poetry]
name = "app"
version = "1.0.0"
  [[tool.poetry.packages]]
  include = "app"

  [tool.poetry.dependencies]
  click = "click"`,
      'apps/app/poetry.lock': `[[package]]
name = "click"
version = "7.1.2"
description = "Composable command line interface toolkit"
category = "main"
optional = false
python-versions = ">=2.7, !=3.0.*, !=3.1.*, !=3.2.*, !=3.3.*, !=3.4.*"

[package.source]
type = "legacy"`,
    });

    const options: BuildExecutorSchema = {
      ignorePaths: ['.venv', '.tox', 'tests/'],
      silent: false,
      outputPath: 'dist/apps/app',
      keepBuildFolder: false,
    };

    const output = await executor(options, {
      cwd: '',
      root: '',
      isVerbose: false,
      projectName: 'app',
      workspace: {
        version: 2,
        npmScope: '@lucasvieira',
        projects: {
          app: {
            root: 'apps/app',
            targets: {},
          }
        },
      },
    });

    expect(existsSync('dist/apps/app/app.fake')).toBeTruthy();
    expect(execSyncMock).toHaveBeenCalledWith('poetry build', {
      cwd: buildPath,
      stdio: 'inherit'
    });
    expect(output.success).toBe(true);
  });

  it('should build python project with poetry.lock has dev dependencies', async () => {
    fsMock({
      'apps/app/app/index.py': 'print("Hello from app")',
      'apps/app/pyproject.toml': `[tool.poetry]
name = "app"
version = "1.0.0"
  [[tool.poetry.packages]]
  include = "app"

  [tool.poetry.dependencies]
  python = "^3.8"
  click = "click"`,
      'apps/app/poetry.lock': `[[package]]
name = "click"
version = "7.1.2"
description = "Composable command line interface toolkit"
category = "main"
optional = false
python-versions = ">=2.7, !=3.0.*, !=3.1.*, !=3.2.*, !=3.3.*, !=3.4.*"

[package.source]
type = "legacy"

[[package]]
name = "mccabe"
version = "0.6.1"
description = "McCabe checker, plugin for flake8"
category = "dev"
optional = false
python-versions = "*"

[package.source]
type = "legacy"`,
    });

    const options: BuildExecutorSchema = {
      ignorePaths: ['.venv', '.tox', 'tests/'],
      silent: false,
      outputPath: 'dist/apps/app',
      keepBuildFolder: false,
    };

    const output = await executor(options, {
      cwd: '',
      root: '',
      isVerbose: false,
      projectName: 'app',
      workspace: {
        version: 2,
        npmScope: '@lucasvieira',
        projects: {
          app: {
            root: 'apps/app',
            targets: {},
          }
        },
      },
    });

    expect(existsSync('dist/apps/app/app.fake')).toBeTruthy();
    expect(execSyncMock).toHaveBeenCalledWith('poetry build', {
      cwd: buildPath,
      stdio: 'inherit'
    });
    expect(output.success).toBe(true);
  });

  it('should build python project and does not print any log', async () => {
    fsMock({
      'apps/app/app/index.py': 'print("Hello from app")',
      'apps/app/pyproject.toml': `[tool.poetry]
name = "app"
version = "1.0.0"
  [[tool.poetry.packages]]
  include = "app"

  [tool.poetry.dependencies]
  python = "^3.8"
  click = "click"`,
      'apps/app/poetry.lock': `[[package]]
name = "click"
version = "7.1.2"
description = "Composable command line interface toolkit"
category = "main"
optional = false
python-versions = ">=2.7, !=3.0.*, !=3.1.*, !=3.2.*, !=3.3.*, !=3.4.*"

[package.source]
type = "legacy"`,
    });

    const options: BuildExecutorSchema = {
      ignorePaths: ['.venv', '.tox', 'tests/'],
      silent: true,
      outputPath: 'dist/apps/app',
      keepBuildFolder: false,
    };

    const logInfoMock = jest.fn()

    console.info = logInfoMock;

    const output = await executor(options, {
      cwd: '',
      root: '',
      isVerbose: false,
      projectName: 'app',
      workspace: {
        version: 2,
        npmScope: '@lucasvieira',
        projects: {
          app: {
            root: 'apps/app',
            targets: {},
          }
        },
      },
    });

    expect(existsSync('dist/apps/app/app.fake')).toBeTruthy();
    expect(execSyncMock).toHaveBeenCalledWith('poetry build', {
      cwd: buildPath,
      stdio: 'inherit'
    });
    expect(logInfoMock).not.toHaveBeenCalled()
    expect(output.success).toBe(true);
  });
});
