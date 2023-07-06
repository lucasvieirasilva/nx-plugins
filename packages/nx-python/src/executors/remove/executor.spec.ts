import { spawnSyncMock } from '../../utils/mocks/cross-spawn.mock';
import * as poetryUtils from '../utils/poetry';
import chalk from 'chalk';
import executor from './executor';
import fsMock from 'mock-fs';
import dedent from 'string-dedent';

describe('Delete Executor', () => {
  let checkPoetryExecutableMock: jest.SpyInstance;
  let activateVenvMock: jest.SpyInstance;
  let getPoetryVersionMock: jest.SpyInstance;

  beforeAll(() => {
    console.log(chalk`init chalk`);
  });

  beforeEach(() => {
    checkPoetryExecutableMock = jest
      .spyOn(poetryUtils, 'checkPoetryExecutable')
      .mockResolvedValue(undefined);
    getPoetryVersionMock = jest
      .spyOn(poetryUtils, 'getPoetryVersion')
      .mockResolvedValue('1.5.0');
    activateVenvMock = jest
      .spyOn(poetryUtils, 'activateVenv')
      .mockReturnValue(undefined);
    spawnSyncMock.mockReturnValue({ status: 0 });
  });

  afterEach(() => {
    fsMock.restore();
    jest.resetAllMocks();
  });

  it('should return success false when the poetry is not installed', async () => {
    checkPoetryExecutableMock.mockRejectedValue(new Error('poetry not found'));

    const options = {
      name: 'shared1',
      local: true,
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
    expect(spawnSyncMock).not.toHaveBeenCalled();
    expect(output.success).toBe(false);
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
      root: '.',
      isVerbose: false,
      projectName: 'lib1',
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
    expect(activateVenvMock).toHaveBeenCalledWith('.');
    expect(spawnSyncMock).toHaveBeenCalledTimes(3);
    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      1,
      'poetry',
      ['remove', 'shared1'],
      {
        cwd: 'libs/lib1',
        shell: false,
        stdio: 'inherit',
      }
    );
    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      2,
      'poetry',
      ['update', 'lib1'],
      {
        cwd: 'apps/app',
        shell: false,
        stdio: 'inherit',
      }
    );
    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      3,
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

  it('should remove the external dependency and update all the dependency tree', async () => {
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
    expect(activateVenvMock).toHaveBeenCalledWith('.');
    expect(spawnSyncMock).toHaveBeenCalledTimes(4);
    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      1,
      'poetry',
      ['remove', 'numpy'],
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
    expect(activateVenvMock).toHaveBeenCalledWith('.');
    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      1,
      'poetry',
      ['remove', 'click', '-vvv'],
      {
        cwd: 'apps/app',
        shell: false,
        stdio: 'inherit',
      }
    );
    expect(output.success).toBe(true);
  });

  it('should remove external dependency with error', async () => {
    spawnSyncMock.mockImplementation(() => {
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
    expect(checkPoetryExecutableMock).toHaveBeenCalled();
    expect(activateVenvMock).toHaveBeenCalledWith('.');
    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      1,
      'poetry',
      ['remove', 'click'],
      {
        cwd: 'apps/app',
        shell: false,
        stdio: 'inherit',
      }
    );
    expect(output.success).toBe(false);
  });

  it('run remove target and should remove the dependency to the project using --lock when the root pyproject.toml is present (poetry version 1.5.0)', async () => {
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
        click = "^8.0"
      `,
    });

    const options = {
      name: 'click',
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
    expect(activateVenvMock).toHaveBeenCalledWith('.');
    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      1,
      'poetry',
      ['remove', 'click', '--lock'],
      {
        cwd: 'apps/app',
        shell: false,
        stdio: 'inherit',
      }
    );
    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      2,
      'poetry',
      ['lock', '--no-update'],
      {
        shell: false,
        stdio: 'inherit',
      }
    );
    expect(spawnSyncMock).toHaveBeenNthCalledWith(3, 'poetry', ['install'], {
      shell: false,
      stdio: 'inherit',
    });
    expect(output.success).toBe(true);
  });

  it('run remove target and should remove the dependency to the project without using --lock when the root pyproject.toml is present (poetry version 1.4.0)', async () => {
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
        click = "^8.0"
      `,
    });

    getPoetryVersionMock.mockResolvedValueOnce('1.4.0');

    const options = {
      name: 'click',
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
    expect(activateVenvMock).toHaveBeenCalledWith('.');
    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      1,
      'poetry',
      ['remove', 'click'],
      {
        cwd: 'apps/app',
        shell: false,
        stdio: 'inherit',
      }
    );
    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      2,
      'poetry',
      ['lock', '--no-update'],
      {
        shell: false,
        stdio: 'inherit',
      }
    );
    expect(spawnSyncMock).toHaveBeenNthCalledWith(3, 'poetry', ['install'], {
      shell: false,
      stdio: 'inherit',
    });
    expect(output.success).toBe(true);
  });
});
