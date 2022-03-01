import { execSyncMock } from '../../utils/mocks/child_process.mock';
import chalk from 'chalk';
import executor from './executor';
import fsMock from 'mock-fs';

describe('Delete Executor', () => {
  beforeAll(() => {
    console.log(chalk`init chalk`);
  });

  afterEach(() => {
    fsMock.restore();
    jest.resetAllMocks();
  });

  it('should remove local dependency and update all the dependency tree', async () => {
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
  name = "shared1"
  version = "1.0.0"
    [[tool.poetry.packages]]
    include = "app"

    [tool.poetry.dependencies]
    python = "^3.8"`,
    });

    const options = {
      name: 'shared1',
      local: true,
    };

    const context = {
      cwd: '',
      root: '',
      isVerbose: false,
      projectName: 'lib1',
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
    expect(execSyncMock).toHaveBeenCalledTimes(3);
    expect(execSyncMock).toHaveBeenNthCalledWith(1, 'poetry remove shared1 ', {
      cwd: 'libs/lib1',
      stdio: 'inherit',
    });
    expect(execSyncMock).toHaveBeenNthCalledWith(2, 'poetry update lib1', {
      cwd: 'apps/app',
      stdio: 'inherit',
    });
    expect(execSyncMock).toHaveBeenNthCalledWith(3, 'poetry update lib1', {
      cwd: 'apps/app1',
      stdio: 'inherit',
    });
    expect(output.success).toBe(true);
  });

  it('should remove the external dependency and update all the dependency tree', async () => {
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

    const context = {
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
    expect(execSyncMock).toHaveBeenNthCalledWith(1, 'poetry remove numpy ', {
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

  it('should remove external dependency with args', async () => {
    fsMock({
      'apps/app/pyproject.toml': `[tool.poetry]
name = "app"
version = "1.0.0"
  [[tool.poetry.packages]]
  include = "app"

  [tool.poetry.dependencies]
  python = "^3.8"
  click = "1.8"
`,
    });
    const options = {
      name: 'click',
      local: false,
      args: '-vvv',
    };

    const context = {
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
    expect(execSyncMock).toHaveBeenCalledTimes(1);
    expect(execSyncMock).toHaveBeenNthCalledWith(
      1,
      'poetry remove click -vvv',
      {
        cwd: 'apps/app',
        stdio: 'inherit',
      }
    );
    expect(output.success).toBe(true);
  });

  it('should remove external dependency with error', async () => {
    execSyncMock.mockImplementation(() => {
      throw new Error('fake error');
    });

    fsMock({
      'apps/app/pyproject.toml': `[tool.poetry]
name = "app"
version = "1.0.0"
  [[tool.poetry.packages]]
  include = "app"

  [tool.poetry.dependencies]
  python = "^3.8"
  click = "1.8"
`,
    });
    const options = {
      name: 'click',
      local: false
    };

    const context = {
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
    expect(execSyncMock).toHaveBeenCalledTimes(1);
    expect(execSyncMock).toHaveBeenNthCalledWith(
      1,
      'poetry remove click ',
      {
        cwd: 'apps/app',
        stdio: 'inherit',
      }
    );
    expect(output.success).toBe(false);
  });
});
