import { spawnSyncMock } from '../../utils/mocks/cross-spawn.mock';
import * as poetryUtils from '../utils/poetry';
import executor from './executor';
import fsMock from 'mock-fs';
import chalk from 'chalk';
import { parseToml } from '../utils/poetry';
import dedent from 'string-dedent';

describe('Add Executor', () => {
  let checkPoetryExecutableMock: jest.SpyInstance;

  beforeAll(() => {
    console.log(chalk`init chalk`);
  });

  beforeEach(() => {
    checkPoetryExecutableMock = jest.spyOn(
      poetryUtils,
      'checkPoetryExecutable'
    );
    checkPoetryExecutableMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    fsMock.restore();
    jest.resetAllMocks();
  });

  it('should return success false when the poetry is not installed', async () => {
    checkPoetryExecutableMock.mockRejectedValue(new Error('poetry not found'));

    const options = {
      name: 'numpy',
      local: false,
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
    expect(spawnSyncMock).not.toHaveBeenCalled();
    expect(output.success).toBe(false);
  });

  it('run add target and should add the dependency to the project', async () => {
    fsMock({
      'apps/app/pyproject.toml': dedent`
      [tool.poetry]
      name = "app"
      version = "1.0.0"
        [[tool.poetry.packages]]
        include = "app"

        [tool.poetry.dependencies]
        python = "^3.8"
        click = "click"

        [tool.poetry.group.dev.dependencies]
        pytest = "6.2.4"
      `,
    });

    const options = {
      name: 'numpy',
      local: false,
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
    expect(spawnSyncMock).toHaveBeenCalledWith('poetry', ['add', 'numpy'], {
      cwd: 'apps/app',
      shell: false,
      stdio: 'inherit',
    });
    expect(output.success).toBe(true);
  });

  it('run add target and should add the dependency to the project group dev', async () => {
    fsMock({
      'apps/app/pyproject.toml': dedent`
      [tool.poetry]
      name = "app"
      version = "1.0.0"
        [[tool.poetry.packages]]
        include = "app"

        [tool.poetry.dependencies]
        python = "^3.8"
        click = "click"

        [tool.poetry.group.dev.dependencies]
        pytest = "6.2.4"
      `,
    });

    const options = {
      name: 'numpy',
      local: false,
      group: 'dev',
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
    expect(spawnSyncMock).toHaveBeenCalledWith(
      'poetry',
      ['add', 'numpy', '--group', 'dev'],
      {
        cwd: 'apps/app',
        shell: false,
        stdio: 'inherit',
      }
    );
    expect(output.success).toBe(true);
  });

  it('run add target and should add the dependency to the project extras', async () => {
    fsMock({
      'apps/app/pyproject.toml': dedent`
      [tool.poetry]
      name = "app"
      version = "1.0.0"
        [[tool.poetry.packages]]
        include = "app"

        [tool.poetry.dependencies]
        python = "^3.8"
        click = "click"

        [tool.poetry.group.dev.dependencies]
        pytest = "6.2.4"
      `,
    });

    const options = {
      name: 'numpy',
      local: false,
      extras: ['dev'],
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
    expect(spawnSyncMock).toHaveBeenCalledWith(
      'poetry',
      ['add', 'numpy', '--extras=dev'],
      {
        cwd: 'apps/app',
        shell: false,
        stdio: 'inherit',
      }
    );
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
    expect(spawnSyncMock).not.toHaveBeenCalled();
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

    spawnSyncMock.mockImplementation(() => {
      throw new Error('fake error');
    });

    const options = {
      name: 'numpy',
      local: false,
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
    expect(spawnSyncMock).toHaveBeenCalledWith('poetry', ['add', 'numpy'], {
      cwd: 'apps/app',
      shell: false,
      stdio: 'inherit',
    });
    expect(output.success).toBe(false);
  });

  it('run add target and should update all the dependency tree', async () => {
    fsMock({
      'apps/app/pyproject.toml': dedent`
      [tool.poetry]
      name = "app"
      version = "1.0.0"
        [[tool.poetry.packages]]
        include = "app"

        [tool.poetry.dependencies]
        python = "^3.8"
        click = "click"
        lib1 = { path = "../../libs/lib1" }
      `,

      'apps/app1/pyproject.toml': dedent`
      [tool.poetry]
      name = "app1"
      version = "1.0.0"
        [[tool.poetry.packages]]
        include = "app"

        [tool.poetry.dependencies]
        python = "^3.8"
        click = "click"
        lib1 = { path = "../../libs/lib1" }
      `,

      'libs/lib1/pyproject.toml': dedent`
      [tool.poetry]
      name = "lib1"
      version = "1.0.0"
        [[tool.poetry.packages]]
        include = "app"

        [tool.poetry.dependencies]
        python = "^3.8"
        shared1 = { path = "../shared1" }
      `,

      'libs/shared1/pyproject.toml': dedent`
      [tool.poetry]
      name = "shared1"
      version = "1.0.0"
        [[tool.poetry.packages]]
        include = "app"

        [tool.poetry.dependencies]
        python = "^3.8"
      `,
    });

    const options = {
      name: 'numpy',
      local: false,
    };

    const context = {
      cwd: '',
      root: '.',
      isVerbose: false,
      projectName: 'shared1',
      workspace: {
        version: 2,
        npmScope: 'nxlv',
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
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    expect(spawnSyncMock).toHaveBeenCalledTimes(4);
    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      1,
      'poetry',
      ['add', 'numpy'],
      {
        cwd: 'libs/shared1',
        shell: false,
        stdio: 'inherit',
      }
    );
    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      2,
      'poetry',
      ['update', 'shared1'],
      {
        cwd: 'libs/lib1',
        shell: false,
        stdio: 'inherit',
      }
    );
    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      3,
      'poetry',
      ['update', 'lib1'],
      {
        cwd: 'apps/app',
        shell: false,
        stdio: 'inherit',
      }
    );
    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      4,
      'poetry',
      ['update', 'lib1'],
      {
        cwd: 'apps/app1',
        shell: false,
        stdio: 'inherit',
      }
    );
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

    const context = {
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
          lib1: {
            root: 'libs/lib1',
            targets: {},
          },
        },
      },
    };

    const output = await executor(options, context);
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      1,
      'poetry',
      ['update', 'lib1'],
      {
        cwd: 'apps/app',
        shell: false,
        stdio: 'inherit',
      }
    );
    expect(output.success).toBe(true);
  });

  it('run add target with local dependency with group dev', async () => {
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
      group: 'dev',
    };

    const context = {
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
          lib1: {
            root: 'libs/lib1',
            targets: {},
          },
        },
      },
    };

    const output = await executor(options, context);
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      1,
      'poetry',
      ['update', 'lib1'],
      {
        cwd: 'apps/app',
        shell: false,
        stdio: 'inherit',
      }
    );
    expect(output.success).toBe(true);
  });

  it('run add target with local dependency with extras', async () => {
    fsMock({
      'apps/app/pyproject.toml': dedent`
      [tool.poetry]
      name = "app"
      version = "1.0.0"
        [[tool.poetry.packages]]
        include = "app"

        [tool.poetry.dependencies]
        python = "^3.8"
        click = "click"
      `,

      'libs/lib1/pyproject.toml': dedent`
      [tool.poetry]
      name = "lib1"
      version = "1.0.0"
        [[tool.poetry.packages]]
        include = "app"

        [tool.poetry.dependencies]
        python = "^3.8"
      `,
    });

    const options = {
      name: 'lib1',
      local: true,
      extras: ['dev'],
    };

    const context = {
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
          lib1: {
            root: 'libs/lib1',
            targets: {},
          },
        },
      },
    };

    const output = await executor(options, context);
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      1,
      'poetry',
      ['update', 'lib1'],
      {
        cwd: 'apps/app',
        shell: false,
        stdio: 'inherit',
      }
    );
    expect(output.success).toBe(true);
  });

  it('run add target with local dependency with extras', async () => {
    fsMock({
      'apps/app/pyproject.toml': dedent`
      [tool.poetry]
      name = "app"
      version = "1.0.0"
        [[tool.poetry.packages]]
        include = "app"

        [tool.poetry.dependencies]
        python = "^3.8"
        click = "click"
      `,

      'libs/lib1/pyproject.toml': dedent`
      [tool.poetry]
      name = "lib1"
      version = "1.0.0"
        [[tool.poetry.packages]]
        include = "app"

        [tool.poetry.dependencies]
        python = "^3.8"
      `,
    });

    const options = {
      name: 'lib1',
      local: true,
      group: 'dev',
      extras: ['dev'],
    };

    const context = {
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
          lib1: {
            root: 'libs/lib1',
            targets: {},
          },
        },
      },
    };

    const output = await executor(options, context);
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      1,
      'poetry',
      ['update', 'lib1'],
      {
        cwd: 'apps/app',
        shell: false,
        stdio: 'inherit',
      }
    );
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

    const context = {
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
          lib1: {
            root: 'libs/lib1',
            targets: {},
          },
        },
      },
    };

    const output = await executor(options, context);
    expect(output.success).toBe(true);
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      1,
      'poetry',
      ['update', 'dgx-devops-lib1'],
      {
        cwd: 'apps/app',
        shell: false,
        stdio: 'inherit',
      }
    );

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
      args: '--group dev',
    };

    const context = {
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
    };

    const output = await executor(options, context);
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    expect(spawnSyncMock).toHaveBeenCalledWith(
      'poetry',
      ['add', 'numpy', '--group', 'dev'],
      {
        cwd: 'apps/app',
        shell: false,
        stdio: 'inherit',
      }
    );
    expect(output.success).toBe(true);
  });

  it('run add target and should add the dependency to the project using --lock when the root pyproject.toml is present', async () => {
    fsMock({
      'pyproject.toml': dedent`
      [tool.poetry]
      name = "app"
      version = "1.0.0"

        [tool.poetry.dependencies]
        python = "^3.8"
        app = { path = "apps/app", develop = true}
      `,
      'apps/app/pyproject.toml': dedent`
      [tool.poetry]
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
    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      1,
      'poetry',
      ['add', 'numpy', '--lock'],
      {
        cwd: 'apps/app',
        shell: false,
        stdio: 'inherit',
      }
    );
    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      2,
      'poetry',
      ['update', 'app'],
      {
        shell: false,
        stdio: 'inherit',
      }
    );
    expect(output.success).toBe(true);
  });
});
