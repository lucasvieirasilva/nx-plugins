import { vi, MockInstance } from 'vitest';
import { vol } from 'memfs';
import '../../utils/mocks/fs.mock';
import '../../utils/mocks/cross-spawn.mock';
import * as poetryUtils from '../../provider/poetry/utils';
import chalk from 'chalk';
import executor from './executor';
import dedent from 'string-dedent';
import spawn from 'cross-spawn';
import { ExecutorContext } from '@nx/devkit';
import { UVProvider } from '../../provider/uv';
import { PoetryProvider } from '../../provider/poetry/provider';

describe('Delete Executor', () => {
  afterEach(() => {
    vol.reset();
    vi.resetAllMocks();
  });

  beforeAll(() => {
    console.log(chalk`init chalk`);
  });

  describe('poetry', () => {
    let checkPoetryExecutableMock: MockInstance;
    let activateVenvMock: MockInstance;
    let getPoetryVersionMock: MockInstance;

    beforeEach(() => {
      checkPoetryExecutableMock = vi
        .spyOn(poetryUtils, 'checkPoetryExecutable')
        .mockResolvedValue(undefined);
      getPoetryVersionMock = vi
        .spyOn(poetryUtils, 'getPoetryVersion')
        .mockResolvedValue('1.5.0');
      activateVenvMock = vi
        .spyOn(PoetryProvider.prototype, 'activateVenv')
        .mockResolvedValue(undefined);
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

    it('should return success false when the poetry is not installed', async () => {
      checkPoetryExecutableMock.mockRejectedValue(
        new Error('poetry not found'),
      );

      const options = {
        name: 'shared1',
        local: true,
      };

      const context: ExecutorContext = {
        cwd: '',
        root: '.',
        isVerbose: false,
        projectName: 'app',
        projectsConfigurations: {
          version: 2,
          projects: {
            app: {
              root: 'apps/app',
              targets: {},
            },
          },
        },
        nxJsonConfiguration: {},
        projectGraph: {
          dependencies: {},
          nodes: {},
        },
      };

      const output = await executor(options, context);
      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.', context);
      expect(spawn.sync).not.toHaveBeenCalled();
      expect(output.success).toBe(false);
    });

    it('should remove local dependency and update all the dependency tree', async () => {
      vol.fromJSON({
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
        name: 'shared1',
        local: true,
      };

      const context: ExecutorContext = {
        cwd: '',
        root: '.',
        isVerbose: false,
        projectName: 'lib1',
        projectsConfigurations: {
          version: 2,
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
        nxJsonConfiguration: {},
        projectGraph: {
          dependencies: {},
          nodes: {},
        },
      };

      const output = await executor(options, context);
      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.', context);
      expect(spawn.sync).toHaveBeenCalledTimes(5);
      expect(spawn.sync).toHaveBeenNthCalledWith(
        1,
        'poetry',
        ['remove', 'shared1'],
        {
          cwd: 'libs/lib1',
          shell: false,
          stdio: 'inherit',
        },
      );
      expect(spawn.sync).toHaveBeenNthCalledWith(
        2,
        'poetry',
        ['lock', '--no-update'],
        {
          cwd: 'apps/app',
          shell: false,
          stdio: 'inherit',
        },
      );
      expect(spawn.sync).toHaveBeenNthCalledWith(
        3,
        'poetry',
        ['install', '-v'],
        {
          cwd: 'apps/app',
          shell: false,
          stdio: 'inherit',
        },
      );
      expect(spawn.sync).toHaveBeenNthCalledWith(
        4,
        'poetry',
        ['lock', '--no-update'],
        {
          cwd: 'apps/app1',
          shell: false,
          stdio: 'inherit',
        },
      );
      expect(spawn.sync).toHaveBeenNthCalledWith(
        5,
        'poetry',
        ['install', '-v'],
        {
          cwd: 'apps/app1',
          shell: false,
          stdio: 'inherit',
        },
      );
      expect(output.success).toBe(true);
    });

    it('should remove local dependency and update all the dependency tree (poetry 2.0.0)', async () => {
      vi.spyOn(poetryUtils, 'getPoetryVersion').mockResolvedValue('2.0.0');
      vol.fromJSON({
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
        name: 'shared1',
        local: true,
      };

      const context: ExecutorContext = {
        cwd: '',
        root: '.',
        isVerbose: false,
        projectName: 'lib1',
        projectsConfigurations: {
          version: 2,
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
        nxJsonConfiguration: {},
        projectGraph: {
          dependencies: {},
          nodes: {},
        },
      };

      const output = await executor(options, context);
      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.', context);
      expect(spawn.sync).toHaveBeenCalledTimes(5);
      expect(spawn.sync).toHaveBeenNthCalledWith(
        1,
        'poetry',
        ['remove', 'shared1'],
        {
          cwd: 'libs/lib1',
          shell: false,
          stdio: 'inherit',
        },
      );
      expect(spawn.sync).toHaveBeenNthCalledWith(2, 'poetry', ['lock'], {
        cwd: 'apps/app',
        shell: false,
        stdio: 'inherit',
      });
      expect(spawn.sync).toHaveBeenNthCalledWith(
        3,
        'poetry',
        ['install', '-v'],
        {
          cwd: 'apps/app',
          shell: false,
          stdio: 'inherit',
        },
      );
      expect(spawn.sync).toHaveBeenNthCalledWith(4, 'poetry', ['lock'], {
        cwd: 'apps/app1',
        shell: false,
        stdio: 'inherit',
      });
      expect(spawn.sync).toHaveBeenNthCalledWith(
        5,
        'poetry',
        ['install', '-v'],
        {
          cwd: 'apps/app1',
          shell: false,
          stdio: 'inherit',
        },
      );
      expect(output.success).toBe(true);
    });

    it('should remove the external dependency and update all the dependency tree', async () => {
      vol.fromJSON({
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

      const context: ExecutorContext = {
        cwd: '',
        root: '.',
        isVerbose: false,
        projectName: 'shared1',
        projectsConfigurations: {
          version: 2,
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
        nxJsonConfiguration: {},
        projectGraph: {
          dependencies: {},
          nodes: {},
        },
      };

      const output = await executor(options, context);
      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.', context);
      expect(spawn.sync).toHaveBeenCalledTimes(7);
      expect(spawn.sync).toHaveBeenNthCalledWith(
        1,
        'poetry',
        ['remove', 'numpy'],
        {
          cwd: 'libs/shared1',
          shell: false,
          stdio: 'inherit',
        },
      );
      expect(spawn.sync).toHaveBeenNthCalledWith(
        2,
        'poetry',
        ['lock', '--no-update'],
        {
          cwd: 'libs/lib1',
          shell: false,
          stdio: 'inherit',
        },
      );
      expect(spawn.sync).toHaveBeenNthCalledWith(
        3,
        'poetry',
        ['install', '-v'],
        {
          cwd: 'libs/lib1',
          shell: false,
          stdio: 'inherit',
        },
      );
      expect(spawn.sync).toHaveBeenNthCalledWith(
        4,
        'poetry',
        ['lock', '--no-update'],
        {
          cwd: 'apps/app',
          shell: false,
          stdio: 'inherit',
        },
      );
      expect(spawn.sync).toHaveBeenNthCalledWith(
        5,
        'poetry',
        ['install', '-v'],
        {
          cwd: 'apps/app',
          shell: false,
          stdio: 'inherit',
        },
      );
      expect(spawn.sync).toHaveBeenNthCalledWith(
        6,
        'poetry',
        ['lock', '--no-update'],
        {
          cwd: 'apps/app1',
          shell: false,
          stdio: 'inherit',
        },
      );
      expect(spawn.sync).toHaveBeenNthCalledWith(
        7,
        'poetry',
        ['install', '-v'],
        {
          cwd: 'apps/app1',
          shell: false,
          stdio: 'inherit',
        },
      );
      expect(output.success).toBe(true);
    });

    it('should remove external dependency with args', async () => {
      vol.fromJSON({
        'apps/app/pyproject.toml': dedent`
        [tool.poetry]
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

      const context: ExecutorContext = {
        cwd: '',
        root: '.',
        isVerbose: false,
        projectName: 'app',
        projectsConfigurations: {
          version: 2,
          projects: {
            app: {
              root: 'apps/app',
              targets: {},
            },
          },
        },
        nxJsonConfiguration: {},
        projectGraph: {
          dependencies: {},
          nodes: {},
        },
      };

      const output = await executor(options, context);
      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.', context);
      expect(spawn.sync).toHaveBeenCalledTimes(1);
      expect(spawn.sync).toHaveBeenNthCalledWith(
        1,
        'poetry',
        ['remove', 'click', '-vvv'],
        {
          cwd: 'apps/app',
          shell: false,
          stdio: 'inherit',
        },
      );
      expect(output.success).toBe(true);
    });

    it('should remove external dependency with error', async () => {
      vi.mocked(spawn.sync).mockImplementation(() => {
        throw new Error('fake error');
      });

      vol.fromJSON({
        'apps/app/pyproject.toml': dedent`
        [tool.poetry]
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

      const context: ExecutorContext = {
        cwd: '',
        root: '.',
        isVerbose: false,
        projectName: 'app',
        projectsConfigurations: {
          version: 2,
          projects: {
            app: {
              root: 'apps/app',
              targets: {},
            },
          },
        },
        nxJsonConfiguration: {},
        projectGraph: {
          dependencies: {},
          nodes: {},
        },
      };

      const output = await executor(options, context);
      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.', context);
      expect(spawn.sync).toHaveBeenCalledTimes(1);
      expect(spawn.sync).toHaveBeenNthCalledWith(
        1,
        'poetry',
        ['remove', 'click'],
        {
          cwd: 'apps/app',
          shell: false,
          stdio: 'inherit',
        },
      );
      expect(output.success).toBe(false);
    });

    it('run remove target and should remove the dependency to the project using --lock when the root pyproject.toml is present (poetry version 1.5.0)', async () => {
      vol.fromJSON({
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

      const context: ExecutorContext = {
        cwd: '',
        root: '.',
        isVerbose: false,
        projectName: 'app',
        projectsConfigurations: {
          version: 2,
          projects: {
            app: {
              root: 'apps/app',
              targets: {},
            },
          },
        },
        nxJsonConfiguration: {},
        projectGraph: {
          dependencies: {},
          nodes: {},
        },
      };

      const output = await executor(options, context);
      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.', context);
      expect(spawn.sync).toHaveBeenNthCalledWith(
        1,
        'poetry',
        ['remove', 'click', '--lock'],
        {
          cwd: 'apps/app',
          shell: false,
          stdio: 'inherit',
        },
      );
      expect(spawn.sync).toHaveBeenNthCalledWith(
        2,
        'poetry',
        ['lock', '--no-update'],
        {
          shell: false,
          stdio: 'inherit',
        },
      );
      expect(spawn.sync).toHaveBeenNthCalledWith(
        3,
        'poetry',
        ['install', '--no-root', '-v'],
        {
          shell: false,
          stdio: 'inherit',
        },
      );
      expect(output.success).toBe(true);
    });

    it('run remove target and should remove the dependency to the project without using --lock when the root pyproject.toml is present (poetry version 1.4.0)', async () => {
      vol.fromJSON({
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

      const context: ExecutorContext = {
        cwd: '',
        root: '.',
        isVerbose: false,
        projectName: 'app',
        projectsConfigurations: {
          version: 2,
          projects: {
            app: {
              root: 'apps/app',
              targets: {},
            },
          },
        },
        nxJsonConfiguration: {},
        projectGraph: {
          dependencies: {},
          nodes: {},
        },
      };

      const output = await executor(options, context);
      expect(checkPoetryExecutableMock).toHaveBeenCalled();
      expect(activateVenvMock).toHaveBeenCalledWith('.', context);
      expect(spawn.sync).toHaveBeenNthCalledWith(
        1,
        'poetry',
        ['remove', 'click'],
        {
          cwd: 'apps/app',
          shell: false,
          stdio: 'inherit',
        },
      );
      expect(spawn.sync).toHaveBeenNthCalledWith(
        2,
        'poetry',
        ['lock', '--no-update'],
        {
          shell: false,
          stdio: 'inherit',
        },
      );
      expect(spawn.sync).toHaveBeenNthCalledWith(
        3,
        'poetry',
        ['install', '--no-root', '-v'],
        {
          shell: false,
          stdio: 'inherit',
        },
      );
      expect(output.success).toBe(true);
    });
  });

  describe('uv', () => {
    let checkPrerequisites: MockInstance;

    beforeEach(() => {
      checkPrerequisites = vi
        .spyOn(UVProvider.prototype, 'checkPrerequisites')
        .mockResolvedValue(undefined);

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

    describe('workspace', () => {
      beforeEach(() => {
        vol.fromJSON({
          'uv.lock': '',
        });
      });

      it('should return success false when the uv is not installed', async () => {
        checkPrerequisites.mockRejectedValue(new Error('uv not found'));

        const options = {
          name: 'shared1',
          local: true,
        };

        const context: ExecutorContext = {
          cwd: '',
          root: '.',
          isVerbose: false,
          projectName: 'app',
          projectsConfigurations: {
            version: 2,
            projects: {
              app: {
                root: 'apps/app',
                targets: {},
              },
            },
          },
          nxJsonConfiguration: {},
          projectGraph: {
            dependencies: {},
            nodes: {},
          },
        };

        const output = await executor(options, context);
        expect(checkPrerequisites).toHaveBeenCalled();
        expect(spawn.sync).not.toHaveBeenCalled();
        expect(output.success).toBe(false);
      });

      it('should remove external dependency with args', async () => {
        const options = {
          name: 'click',
          local: false,
          args: '-vvv',
        };

        const context: ExecutorContext = {
          cwd: '',
          root: '.',
          isVerbose: false,
          projectName: 'app',
          projectsConfigurations: {
            version: 2,
            projects: {
              app: {
                root: 'apps/app',
                targets: {},
              },
            },
          },
          nxJsonConfiguration: {},
          projectGraph: {
            dependencies: {},
            nodes: {},
          },
        };

        const output = await executor(options, context);
        expect(checkPrerequisites).toHaveBeenCalled();
        expect(spawn.sync).toHaveBeenCalledTimes(1);
        expect(spawn.sync).toHaveBeenNthCalledWith(
          1,
          'uv',
          ['remove', 'click', '--project', 'apps/app', '-vvv'],
          {
            cwd: '.',
            shell: false,
            stdio: 'inherit',
          },
        );
        expect(output.success).toBe(true);
      });
    });

    describe('project', () => {
      it('run remove target and should update all the dependency tree', async () => {
        vol.fromJSON({
          'apps/app/pyproject.toml': dedent`
          [project]
          name = "app"
          version = "0.1.0"
          readme = "README.md"
          requires-python = ">=3.12"
          dependencies = [
              "lib1",
          ]

          [tool.hatch.build.targets.wheel]
          packages = ["app"]

          [tool.uv.sources]
          lib1 = { path = "../../libs/lib1" }
          `,

          'apps/app1/pyproject.toml': dedent`
          [project]
          name = "app1"
          version = "0.1.0"
          readme = "README.md"
          requires-python = ">=3.12"
          dependencies = [
              "lib1",
          ]

          [tool.hatch.build.targets.wheel]
          packages = ["app1"]

          [tool.uv.sources]
          lib1 = { path = "../../libs/lib1" }
          `,

          'libs/lib1/pyproject.toml': dedent`
          [project]
          name = "lib1"
          version = "0.1.0"
          readme = "README.md"
          requires-python = ">=3.12"
          dependencies = [
              "shared1",
          ]

          [tool.hatch.build.targets.wheel]
          packages = ["lib1"]

          [tool.uv.sources]
          shared1 = { path = "../shared1" }
          `,

          'libs/shared1/pyproject.toml': dedent`
          [project]
          name = "shared1"
          version = "0.1.0"
          readme = "README.md"
          requires-python = ">=3.12"
          dependencies = []

          [tool.hatch.build.targets.wheel]
          packages = ["shared1"]
          `,
        });

        const options = {
          name: 'numpy',
          local: false,
        };

        const context: ExecutorContext = {
          cwd: '',
          root: '.',
          isVerbose: false,
          projectName: 'shared1',
          projectsConfigurations: {
            version: 2,
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
          nxJsonConfiguration: {},
          projectGraph: {
            dependencies: {},
            nodes: {},
          },
        };

        const output = await executor(options, context);
        expect(checkPrerequisites).toHaveBeenCalled();
        expect(spawn.sync).toHaveBeenCalledTimes(4);
        expect(spawn.sync).toHaveBeenNthCalledWith(
          1,
          'uv',
          ['remove', 'numpy'],
          {
            cwd: 'libs/shared1',
            shell: false,
            stdio: 'inherit',
          },
        );
        expect(spawn.sync).toHaveBeenNthCalledWith(2, 'uv', ['sync'], {
          cwd: 'libs/lib1',
          shell: false,
          stdio: 'inherit',
        });
        expect(spawn.sync).toHaveBeenNthCalledWith(3, 'uv', ['sync'], {
          cwd: 'apps/app',
          shell: false,
          stdio: 'inherit',
        });
        expect(spawn.sync).toHaveBeenNthCalledWith(4, 'uv', ['sync'], {
          cwd: 'apps/app1',
          shell: false,
          stdio: 'inherit',
        });
        expect(output.success).toBe(true);
      });
    });
  });
});
