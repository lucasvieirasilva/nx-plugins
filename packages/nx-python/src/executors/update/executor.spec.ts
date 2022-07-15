import { spawnSyncMock } from '../../utils/mocks/cross-spawn.mock';
import executor from './executor';
import fsMock from 'mock-fs';
import chalk from 'chalk';
import { parseToml } from '../utils/poetry';
import dedent from 'string-dedent';

describe('Update Executor', () => {
  beforeAll(() => {
    console.log(chalk`init chalk`);
  });

  afterEach(() => {
    fsMock.restore();
    jest.resetAllMocks();
  });

  it('run update target and should update the dependency to the project', async () => {
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
    expect(spawnSyncMock).toHaveBeenCalledWith('poetry', ['update', 'numpy'], {
      cwd: 'apps/app',
      shell: false,
      stdio: 'inherit',
    });
    expect(output.success).toBe(true);
  });

  it('run update target and should not update the dependency to the project because the project does not exist', async () => {
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
    expect(spawnSyncMock).not.toHaveBeenCalled();
    expect(output.success).toBe(false);
  });

  it('run update target and should throw an exception', async () => {
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
    expect(spawnSyncMock).toHaveBeenCalledWith('poetry', ['update', 'numpy'], {
      cwd: 'apps/app',
      shell: false,
      stdio: 'inherit',
    });
    expect(output.success).toBe(false);
  });

  it('run update target and should update all the dependency tree', async () => {
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
    expect(spawnSyncMock).toHaveBeenCalledTimes(4);
    expect(spawnSyncMock).toHaveBeenNthCalledWith(1, 'poetry', ['update', 'numpy'], {
      cwd: 'libs/shared1',
      shell: false,
      stdio: 'inherit',
    });
    expect(spawnSyncMock).toHaveBeenNthCalledWith(2, 'poetry', ['update', 'lib1'], {
      cwd: 'libs/lib1',
      shell: false,
      stdio: 'inherit',
    });
    expect(spawnSyncMock).toHaveBeenNthCalledWith(3, 'poetry', ['update', 'lib1'], {
      cwd: 'apps/app',
      shell: false,
      stdio: 'inherit',
    });
    expect(spawnSyncMock).toHaveBeenNthCalledWith(4, 'poetry', ['update', 'lib1'], {
      cwd: 'apps/app1',
      shell: false,
      stdio: 'inherit',
    });
    expect(output.success).toBe(true);
  });

  it('run update target with local dependency', async () => {
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
    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    expect(spawnSyncMock).toHaveBeenNthCalledWith(1, 'poetry', ['update', 'lib1'], {
      cwd: 'apps/app',
      shell: false,
      stdio: 'inherit',
    });
    expect(output.success).toBe(true);
  });

  it('run update target with local dependency with project name and package name different', async () => {
    fsMock({
      'apps/app/pyproject.toml': dedent`
      [tool.poetry]
      name = "dgx-devops-app"
      version = "1.0.0"
        [[tool.poetry.packages]]
        include = "app"

        [tool.poetry.dependencies]
        python = "^3.8"
        click = "click"
        dgx-devops-lib1 = { path = "../../libs/lib1", develop = true }
      `,
      'libs/lib1/pyproject.toml': dedent`
      [tool.poetry]
      name = "dgx-devops-lib1"
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
    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    expect(spawnSyncMock).toHaveBeenNthCalledWith(1, 'poetry', ['update', 'dgx-devops-lib1'], {
      cwd: 'apps/app',
      shell: false,
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

  it('run update target and should update the dependency using custom args', async () => {
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
    expect(spawnSyncMock).toHaveBeenCalledWith('poetry', ['update', 'numpy', '--group', 'dev'], {
      cwd: 'apps/app',
      shell: false,
      stdio: 'inherit',
    });
    expect(output.success).toBe(true);
  });

  it('run update target and should update all dependencies', async () => {
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
      local: false
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
    expect(spawnSyncMock).toHaveBeenCalledWith('poetry', ['update'], {
      cwd: 'apps/app',
      shell: false,
      stdio: 'inherit',
    });
    expect(output.success).toBe(true);
  });

  it('run update target and should the root pyproject.toml', async () => {
    fsMock({
      'pyproject.toml': dedent`
      [tool.poetry]
      name = "root"
      version = "1.0.0"

        [tool.poetry.dependencies]
        python = "^3.8"
        app = { path = "apps/app", develop = true }
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
    expect(spawnSyncMock).toHaveBeenNthCalledWith(1, 'poetry', ['update', 'numpy', '--lock'], {
      cwd: 'apps/app',
      shell: false,
      stdio: 'inherit',
    });
    expect(spawnSyncMock).toHaveBeenNthCalledWith(2, 'poetry', ['update', 'app'], {
      shell: false,
      stdio: 'inherit',
    });
    expect(output.success).toBe(true);
  });

  it('run update target and should update all the dependency tree using --lock when pyproject.toml is present', async () => {
    fsMock({
      'pyproject.toml': dedent`
      [tool.poetry]
      name = "root"
      version = "1.0.0"

        [tool.poetry.dependencies]
        python = "^3.8"
        app = { path = "apps/app", develop = true }
        app1 = { path = "apps/app1", develop = true }
        lib1 = { path = "libs/lib1", develop = true }
        shared1 = { path = "libs/shared1", develop = true }
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
        shared1 = { path = "../../libs/shared1" }
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
    expect(spawnSyncMock).toHaveBeenCalledTimes(5);
    expect(spawnSyncMock).toHaveBeenNthCalledWith(1, 'poetry', ['update', 'numpy', '--lock'], {
      cwd: 'libs/shared1',
      shell: false,
      stdio: 'inherit',
    });
    expect(spawnSyncMock).toHaveBeenNthCalledWith(2, 'poetry', ['update', 'shared1', '--lock'], {
      cwd: 'libs/lib1',
      shell: false,
      stdio: 'inherit',
    });
    expect(spawnSyncMock).toHaveBeenNthCalledWith(3, 'poetry', ['update', 'shared1', '--lock'], {
      cwd: 'apps/app',
      shell: false,
      stdio: 'inherit',
    });
    expect(spawnSyncMock).toHaveBeenNthCalledWith(4, 'poetry', ['update', 'shared1', '--lock'], {
      cwd: 'apps/app1',
      shell: false,
      stdio: 'inherit',
    });
    expect(spawnSyncMock).toHaveBeenNthCalledWith(5, 'poetry', ['update', 'shared1'], {
      shell: false,
      stdio: 'inherit',
    });
    expect(output.success).toBe(true);
  });
});
