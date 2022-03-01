import { execSyncMock } from '../../utils/mocks/child_process.mock';
import executor from './executor';
import fsMock from 'mock-fs';
import chalk from 'chalk';
import { parseToml } from '../utils/poetry';
import { ExecutorContext } from '@nrwl/devkit';

describe('Add Executor', () => {
  beforeAll(() => {
    console.log(chalk`init chalk`);
  });

  afterEach(() => {
    fsMock.restore();
    jest.resetAllMocks();
  });

  it('run add target and should add the dependency to the project', async () => {
    fsMock({
      'apps/app/pyproject.toml': `[tool.poetry]
name = "app"
version = "1.0.0"
  [[tool.poetry.packages]]
  include = "app"

  [tool.poetry.dependencies]
  python = "^3.8"
  click = "click"
`,
    });

    const options = {
      name: 'numpy',
      local: false,
    };

    const context: ExecutorContext = {
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
        },
      },
    };

    const output = await executor(options, context);
    expect(execSyncMock).toHaveBeenCalledWith('poetry add numpy ', {
      cwd: 'apps/app',
      stdio: 'inherit',
    });
    expect(output.success).toBe(true);
  });

  it('run add target and should not add the dependency to the project because the project does not exist', async () => {
    fsMock({
      'apps/app/pyproject.toml': `[tool.poetry]
name = "app"
version = "1.0.0"
  [[tool.poetry.packages]]
  include = "app"

  [tool.poetry.dependencies]
  python = "^3.8"
  click = "click"
`,
    });

    const options = {
      local: true,
      name: 'lib1',
    };

    const context: ExecutorContext = {
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
        },
      },
    };

    const output = await executor(options, context);
    expect(execSyncMock).not.toHaveBeenCalled();
    expect(output.success).toBe(false);
  });

  it('run add target and should throw an exception', async () => {
    fsMock({
      'apps/app/pyproject.toml': `[tool.poetry]
name = "app"
version = "1.0.0"
  [[tool.poetry.packages]]
  include = "app"

  [tool.poetry.dependencies]
  python = "^3.8"
  click = "click"
`,
    });

    execSyncMock.mockImplementation(() => {
      throw new Error('fake error');
    });

    const options = {
      name: 'numpy',
      local: false,
    };

    const context: ExecutorContext = {
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
        },
      },
    };

    const output = await executor(options, context);
    expect(execSyncMock).toHaveBeenCalledWith('poetry add numpy ', {
      cwd: 'apps/app',
      stdio: 'inherit',
    });
    expect(output.success).toBe(false);
  });

  it('run add target and should update all the dependency tree', async () => {
    fsMock({
      'apps/app/pyproject.toml': `[tool.poetry]
name = "app"
version = "1.0.0"
  [[tool.poetry.packages]]
  include = "app"

  [tool.poetry.dependencies]
  python = "^3.8"
  click = "click"
  lib1 = { path = "../../libs/lib1" }
`,

      'apps/app1/pyproject.toml': `[tool.poetry]
name = "app1"
version = "1.0.0"
  [[tool.poetry.packages]]
  include = "app"

  [tool.poetry.dependencies]
  python = "^3.8"
  click = "click"
  lib1 = { path = "../../libs/lib1" }
`,

      'libs/lib1/pyproject.toml': `[tool.poetry]
  name = "lib1"
  version = "1.0.0"
    [[tool.poetry.packages]]
    include = "app"

    [tool.poetry.dependencies]
    python = "^3.8"
    shared1 = { path = "../../libs/shared1" }`,

      'libs/shared1/pyproject.toml': `[tool.poetry]
  name = "lib1"
  version = "1.0.0"
    [[tool.poetry.packages]]
    include = "app"

    [tool.poetry.dependencies]
    python = "^3.8"`,
    });

    const options = {
      name: 'numpy',
      local: false,
    };

    const context: ExecutorContext = {
      cwd: '',
      root: '',
      isVerbose: false,
      projectName: 'shared1',
      workspace: {
        version: 2,
        npmScope: '@lucasvieira',
        projects: {
          app: {
            root: 'apps/app',
            targets: {},
          },
          app1: {
            root: 'apps/app1',
            targets: {},
          },
          app3: {
            root: 'apps/app3',
            targets: {},
          },
          lib1: {
            root: 'libs/lib1',
            targets: {},
          },
          shared1: {
            root: 'libs/shared1',
            targets: {},
          },
        },
      },
    };

    const output = await executor(options, context);
    expect(execSyncMock).toHaveBeenCalledTimes(4);
    expect(execSyncMock).toHaveBeenNthCalledWith(1, 'poetry add numpy ', {
      cwd: 'libs/shared1',
      stdio: 'inherit',
    });
    expect(execSyncMock).toHaveBeenNthCalledWith(2, 'poetry update lib1', {
      cwd: 'libs/lib1',
      stdio: 'inherit',
    });
    expect(execSyncMock).toHaveBeenNthCalledWith(3, 'poetry update lib1', {
      cwd: 'apps/app',
      stdio: 'inherit',
    });
    expect(execSyncMock).toHaveBeenNthCalledWith(4, 'poetry update lib1', {
      cwd: 'apps/app1',
      stdio: 'inherit',
    });
    expect(output.success).toBe(true);
  });

  it('run add target with local dependency', async () => {
    fsMock({
      'apps/app/pyproject.toml': `[tool.poetry]
name = "app"
version = "1.0.0"
  [[tool.poetry.packages]]
  include = "app"

  [tool.poetry.dependencies]
  python = "^3.8"
  click = "click"`,

      'libs/lib1/pyproject.toml': `[tool.poetry]
name = "lib1"
version = "1.0.0"
  [[tool.poetry.packages]]
  include = "app"

  [tool.poetry.dependencies]
  python = "^3.8"`,
    });

    const options = {
      name: 'lib1',
      local: true,
    };

    const context: ExecutorContext = {
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
          lib1: {
            root: 'libs/lib1',
            targets: {},
          },
        },
      },
    };

    const output = await executor(options, context);
    expect(execSyncMock).toHaveBeenCalledTimes(1);
    expect(execSyncMock).toHaveBeenNthCalledWith(1, 'poetry update lib1', {
      cwd: 'apps/app',
      stdio: 'inherit',
    });
    expect(output.success).toBe(true);
  });

  it('run add target with local dependency with project name and package name different', async () => {
    fsMock({
      'apps/app/pyproject.toml': `[tool.poetry]
name = "dgx-devops-app"
version = "1.0.0"
  [[tool.poetry.packages]]
  include = "app"

  [tool.poetry.dependencies]
  python = "^3.8"
  click = "click"`,

      'libs/lib1/pyproject.toml': `[tool.poetry]
name = "dgx-devops-lib1"
version = "1.0.0"
  [[tool.poetry.packages]]
  include = "app"

  [tool.poetry.dependencies]
  python = "^3.8"`,
    });

    const options = {
      name: 'lib1',
      local: true,
    };

    const context: ExecutorContext = {
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
          lib1: {
            root: 'libs/lib1',
            targets: {},
          },
        },
      },
    };

    const output = await executor(options, context);
    expect(execSyncMock).toHaveBeenCalledTimes(1);
    expect(execSyncMock).toHaveBeenNthCalledWith(1, 'poetry update dgx-devops-lib1', {
      cwd: 'apps/app',
      stdio: 'inherit',
    });
    expect(output.success).toBe(true);

    const {
      tool: {
        poetry: { dependencies },
      },
    } = parseToml('apps/app/pyproject.toml');

    expect(dependencies['dgx-devops-lib1']).toStrictEqual({
      path: '../../libs/lib1',
      develop: true,
    });
  });

  it('run add target and should add the dependency using custom args', async () => {
    fsMock({
      'apps/app/pyproject.toml': `[tool.poetry]
name = "app"
version = "1.0.0"
  [[tool.poetry.packages]]
  include = "app"

  [tool.poetry.dependencies]
  python = "^3.8"
  click = "click"
`,
    });

    const options = {
      name: 'numpy',
      local: false,
      args: "--group dev"
    };

    const context: ExecutorContext = {
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
        },
      },
    };

    const output = await executor(options, context);
    expect(execSyncMock).toHaveBeenCalledWith('poetry add numpy --group dev', {
      cwd: 'apps/app',
      stdio: 'inherit',
    });
    expect(output.success).toBe(true);
  });
});
