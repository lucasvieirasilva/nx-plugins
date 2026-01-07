import '../../utils/mocks/cross-spawn.mock';
import * as poetryUtils from '../../provider/poetry/utils';
import { PoetryProvider } from '../../provider/poetry/provider';
import { UVProvider } from '../../provider/uv/provider';
import spawn from 'cross-spawn';
import { assert, MockInstance } from 'vitest';

const mocks = vi.hoisted(() => ({
  createProjectGraphAsync: vi.fn(),
}));

vi.mock('@nx/devkit', async () => {
  const actual = (await vi.importActual(
    '@nx/devkit',
  )) as typeof import('@nx/devkit');
  return {
    ...actual,
    createProjectGraphAsync: mocks.createProjectGraphAsync,
  };
});

import {
  DependencyType,
  ExecutorContext,
  NxJsonConfiguration,
  ProjectConfiguration,
  type ProjectGraph,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import syncGenerator from './generator';
import dedent from 'string-dedent';

describe('pkg-sync generator', () => {
  let tree: Tree;
  let baseContext: ExecutorContext;
  let checkPoetryExecutableMock: MockInstance;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(spawn.sync).mockReturnValue({
      status: 0,
      output: [''],
      pid: 0,
      signal: null,
      stderr: null,
      stdout: null,
    });
    vi.spyOn(process, 'chdir').mockReturnValue(undefined);

    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    tree.root = '';

    baseContext = {
      cwd: tree.root,
      isVerbose: false,
      nxJsonConfiguration: {},
      projectGraph: {
        dependencies: {},
        nodes: {},
      },
      projectsConfigurations: {
        version: 2,
        projects: {},
      },
      root: tree.root,
    };
  });

  describe('poetry', () => {
    let activateVenvMock: MockInstance;

    beforeEach(() => {
      const nxJson: NxJsonConfiguration = {
        plugins: [
          {
            plugin: '@nxlv/python',
            options: {
              packageManager: 'poetry',
            },
          },
        ],
      };
      tree.write('nx.json', JSON.stringify(nxJson));
      baseContext.nxJsonConfiguration = nxJson;

      checkPoetryExecutableMock = vi
        .spyOn(poetryUtils, 'checkPoetryExecutable')
        .mockResolvedValue(undefined);
      vi.spyOn(poetryUtils, 'getPoetryVersion').mockResolvedValue('1.8.2');
      activateVenvMock = vi
        .spyOn(PoetryProvider.prototype, 'activateVenv')
        .mockResolvedValue(undefined);
    });

    describe('project', () => {
      it('should sync a project with a missing dependency', async () => {
        const projectGraph: ProjectGraph = {
          nodes: {
            app1: {
              name: 'app1',
              type: 'app',
              data: {
                root: 'apps/app1',
                targets: {},
              },
            },
            dep1: {
              name: 'dep1',
              type: 'lib',
              data: {
                root: 'libs/dep1',
                targets: {},
              },
            },
          },
          dependencies: {
            app1: [
              {
                target: 'dep1',
                source: 'app1',
                type: DependencyType.dynamic,
              },
            ],
          },
        };

        const context: ExecutorContext = {
          ...baseContext,
          projectGraph: projectGraph,
          projectsConfigurations: {
            version: 2,
            projects: parseProjectGraphToConfig(projectGraph),
          },
        };

        tree.write(
          'apps/app1/pyproject.toml',
          dedent`
          [tool.poetry]
          name = "app1"
          version = "1.0.0"
          `,
          // Intentionally missing the dep1 dependency
        );
        tree.write(
          'libs/dep1/pyproject.toml',
          dedent`
          [tool.poetry]
          name = "dep1"
          version = "1.0.0"
          `,
        );

        mocks.createProjectGraphAsync.mockResolvedValue(projectGraph);
        const result = await syncGenerator(tree);

        assert(result, 'result is not defined');
        expect(result).toBeDefined();
        expect(result).toBeTypeOf('object');
        expect(result.outOfSyncMessage).toBe(
          'Project app1 is out of sync. Missing dependencies: dep1\n',
        );
        expect(result.callback).toBeDefined();

        await result.callback();

        expect(checkPoetryExecutableMock).toHaveBeenCalled();
        expect(activateVenvMock).toHaveBeenCalledWith(tree.root, false, {
          ...context,
          projectName: 'app1',
        });

        expect(spawn.sync).toHaveBeenCalledTimes(2);
        expect(spawn.sync).toHaveBeenNthCalledWith(
          1,
          'poetry',
          ['lock', '--no-update'],
          {
            cwd: 'apps/app1',
            shell: false,
            stdio: 'inherit',
          },
        );
        expect(spawn.sync).toHaveBeenNthCalledWith(
          2,
          'poetry',
          ['install', '-v'],
          {
            cwd: 'apps/app1',
            shell: false,
            stdio: 'inherit',
          },
        );

        expect(
          tree.read('apps/app1/pyproject.toml', 'utf-8'),
        ).toMatchSnapshot();
      });

      it('should sync a project with a missing dependency with dependents', async () => {
        const projectGraph: ProjectGraph = {
          nodes: {
            app1: {
              name: 'app1',
              type: 'app',
              data: {
                root: 'apps/app1',
                targets: {},
              },
            },
            dep1: {
              name: 'dep1',
              type: 'lib',
              data: {
                root: 'libs/dep1',
                targets: {},
              },
            },
            dep2: {
              name: 'dep2',
              type: 'lib',
              data: {
                root: 'libs/dep2',
                targets: {},
              },
            },
          },
          dependencies: {
            app1: [
              {
                target: 'dep1',
                source: 'app1',
                type: DependencyType.implicit,
              },
            ],
            dep1: [
              {
                target: 'dep2',
                source: 'dep1',
                type: DependencyType.dynamic,
              },
            ],
          },
        };

        const context: ExecutorContext = {
          ...baseContext,
          projectGraph: projectGraph,
          projectsConfigurations: {
            version: 2,
            projects: parseProjectGraphToConfig(projectGraph),
          },
        };

        tree.write(
          'apps/app1/pyproject.toml',
          dedent`
          [tool.poetry]
          name = "app1"
          version = "1.0.0"

          [tool.poetry.dependencies]
          dep1 = { path = "../../libs/dep1", develop = true }
          `,
        );
        tree.write(
          'libs/dep1/pyproject.toml',
          dedent`
          [tool.poetry]
          name = "dep1"
          version = "1.0.0"
          `,
          // Intentionally missing the dep2 dependency
        );
        tree.write(
          'libs/dep2/pyproject.toml',
          dedent`
          [tool.poetry]
          name = "dep2"
          version = "1.0.0"
          `,
        );

        mocks.createProjectGraphAsync.mockResolvedValue(projectGraph);
        const result = await syncGenerator(tree);

        assert(result, 'result is not defined');
        expect(result).toBeDefined();
        expect(result).toBeTypeOf('object');
        expect(result.outOfSyncMessage).toBe(
          'Project dep1 is out of sync. Missing dependencies: dep2\n',
        );
        expect(result.callback).toBeDefined();

        await result.callback();

        expect(checkPoetryExecutableMock).toHaveBeenCalled();
        expect(activateVenvMock).toHaveBeenCalledWith(tree.root, false, {
          ...context,
          projectName: 'app1',
        });

        expect(spawn.sync).toHaveBeenCalledTimes(4);
        expect(spawn.sync).toHaveBeenNthCalledWith(
          1,
          'poetry',
          ['lock', '--no-update'],
          {
            cwd: 'libs/dep1',
            shell: false,
            stdio: 'inherit',
          },
        );
        expect(spawn.sync).toHaveBeenNthCalledWith(
          2,
          'poetry',
          ['install', '-v'],
          {
            cwd: 'libs/dep1',
            shell: false,
            stdio: 'inherit',
          },
        );
        expect(spawn.sync).toHaveBeenNthCalledWith(
          3,
          'poetry',
          ['lock', '--no-update'],
          {
            cwd: 'apps/app1',
            shell: false,
            stdio: 'inherit',
          },
        );
        expect(spawn.sync).toHaveBeenNthCalledWith(
          4,
          'poetry',
          ['install', '-v'],
          {
            cwd: 'apps/app1',
            shell: false,
            stdio: 'inherit',
          },
        );

        expect(
          tree.read('libs/dep1/pyproject.toml', 'utf-8'),
        ).toMatchSnapshot();
      });
    });
    describe('workspace', () => {
      it('should sync a project with a missing dependency', async () => {
        const projectGraph: ProjectGraph = {
          nodes: {
            app1: {
              name: 'app1',
              type: 'app',
              data: {
                root: 'apps/app1',
                targets: {},
              },
            },
            dep1: {
              name: 'dep1',
              type: 'lib',
              data: {
                root: 'libs/dep1',
                targets: {},
              },
            },
          },
          dependencies: {
            app1: [
              {
                target: 'dep1',
                source: 'app1',
                type: DependencyType.dynamic,
              },
            ],
          },
        };

        const context: ExecutorContext = {
          ...baseContext,
          projectGraph: projectGraph,
          projectsConfigurations: {
            version: 2,
            projects: parseProjectGraphToConfig(projectGraph),
          },
        };

        tree.write(
          'pyproject.toml',
          dedent`
          [tool.poetry]
          name = "workspace"
          version = "1.0.0"
          
          [tool.poetry.dependencies]
          app1 = { path = "apps/app1" }
          `,
          // Intentionally missing the dep1 dependency
        );

        tree.write(
          'apps/app1/pyproject.toml',
          dedent`
          [tool.poetry]
          name = "app1"
          version = "1.0.0"
          `,
          // Intentionally missing the dep1 dependency
        );
        tree.write(
          'libs/dep1/pyproject.toml',
          dedent`
          [tool.poetry]
          name = "dep1"
          version = "1.0.0"
          `,
        );

        mocks.createProjectGraphAsync.mockResolvedValue(projectGraph);
        const result = await syncGenerator(tree);

        assert(result, 'result is not defined');
        expect(result).toBeDefined();
        expect(result).toBeTypeOf('object');
        expect(result.outOfSyncMessage).toBe(
          'Project app1 is out of sync. Missing dependencies: dep1\n' +
            'Root pyproject.toml is out of sync. Missing dependency: dep1\n',
        );
        expect(result.callback).toBeDefined();

        await result.callback();

        expect(checkPoetryExecutableMock).toHaveBeenCalled();
        expect(activateVenvMock).toHaveBeenCalledWith(tree.root, false, {
          ...context,
          projectName: 'app1',
        });

        expect(spawn.sync).toHaveBeenCalledTimes(3);
        expect(spawn.sync).toHaveBeenNthCalledWith(
          1,
          'poetry',
          ['lock', '--no-update'],
          {
            cwd: 'apps/app1',
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

        expect(
          tree.read('apps/app1/pyproject.toml', 'utf-8'),
        ).toMatchSnapshot();
        expect(tree.read('pyproject.toml', 'utf-8')).toMatchSnapshot();
      });

      it('should sync a project with a missing dependency with dependents', async () => {
        const projectGraph: ProjectGraph = {
          nodes: {
            app1: {
              name: 'app1',
              type: 'app',
              data: {
                root: 'apps/app1',
                targets: {},
              },
            },
            dep1: {
              name: 'dep1',
              type: 'lib',
              data: {
                root: 'libs/dep1',
                targets: {},
              },
            },
            dep2: {
              name: 'dep2',
              type: 'lib',
              data: {
                root: 'libs/dep2',
                targets: {},
              },
            },
          },
          dependencies: {
            app1: [
              {
                target: 'dep1',
                source: 'app1',
                type: DependencyType.implicit,
              },
            ],
            dep1: [
              {
                target: 'dep2',
                source: 'dep1',
                type: DependencyType.dynamic,
              },
            ],
          },
        };

        const context: ExecutorContext = {
          ...baseContext,
          projectGraph: projectGraph,
          projectsConfigurations: {
            version: 2,
            projects: parseProjectGraphToConfig(projectGraph),
          },
        };

        tree.write(
          'pyproject.toml',
          dedent`
          [tool.poetry]
          name = "workspace"
          version = "1.0.0"
          
          [tool.poetry.dependencies]
          app1 = { path = "apps/app1", develop = true }
          dep1 = { path = "libs/dep1", develop = true }
          `,
          // Intentionally missing the dep2 dependency
        );

        tree.write(
          'apps/app1/pyproject.toml',
          dedent`
          [tool.poetry]
          name = "app1"
          version = "1.0.0"

          [tool.poetry.dependencies]
          dep1 = { path = "../../libs/dep1", develop = true }
          `,
        );
        tree.write(
          'libs/dep1/pyproject.toml',
          dedent`
          [tool.poetry]
          name = "dep1"
          version = "1.0.0"
          `,
        );
        tree.write(
          'libs/dep2/pyproject.toml',
          dedent`
          [tool.poetry]
          name = "dep2"
          version = "1.0.0"
          `,
        );

        mocks.createProjectGraphAsync.mockResolvedValue(projectGraph);
        const result = await syncGenerator(tree);

        assert(result, 'result is not defined');
        expect(result).toBeDefined();
        expect(result).toBeTypeOf('object');
        expect(result.outOfSyncMessage).toBe(
          'Project dep1 is out of sync. Missing dependencies: dep2\n' +
            'Root pyproject.toml is out of sync. Missing dependency: dep2\n',
        );
        expect(result.callback).toBeDefined();

        await result.callback();

        expect(checkPoetryExecutableMock).toHaveBeenCalled();
        expect(activateVenvMock).toHaveBeenCalledWith(tree.root, false, {
          ...context,
          projectName: 'app1',
        });

        expect(spawn.sync).toHaveBeenCalledTimes(4);
        expect(spawn.sync).toHaveBeenNthCalledWith(
          1,
          'poetry',
          ['lock', '--no-update'],
          {
            cwd: 'libs/dep1',
            shell: false,
            stdio: 'inherit',
          },
        );
        expect(spawn.sync).toHaveBeenNthCalledWith(
          2,
          'poetry',
          ['lock', '--no-update'],
          {
            cwd: 'apps/app1',
            shell: false,
            stdio: 'inherit',
          },
        );
        expect(spawn.sync).toHaveBeenNthCalledWith(
          3,
          'poetry',
          ['lock', '--no-update'],
          {
            shell: false,
            stdio: 'inherit',
          },
        );
        expect(spawn.sync).toHaveBeenNthCalledWith(
          4,
          'poetry',
          ['install', '--no-root', '-v'],
          {
            shell: false,
            stdio: 'inherit',
          },
        );

        expect(
          tree.read('libs/dep1/pyproject.toml', 'utf-8'),
        ).toMatchSnapshot();
        expect(tree.read('pyproject.toml', 'utf-8')).toMatchSnapshot();
      });

      it('should only sync the root project when there are no missing dependencies', async () => {
        const projectGraph: ProjectGraph = {
          nodes: {
            app1: {
              name: 'app1',
              type: 'app',
              data: {
                root: 'apps/app1',
                targets: {},
              },
            },
            dep1: {
              name: 'dep1',
              type: 'lib',
              data: {
                root: 'libs/dep1',
                targets: {},
              },
            },
          },
          dependencies: {
            app1: [
              {
                target: 'dep1',
                source: 'app1',
                type: DependencyType.implicit,
              },
            ],
          },
        };

        const context: ExecutorContext = {
          ...baseContext,
          projectGraph: projectGraph,
          projectsConfigurations: {
            version: 2,
            projects: parseProjectGraphToConfig(projectGraph),
          },
        };

        tree.write(
          'pyproject.toml',
          dedent`
          [tool.poetry]
          name = "workspace"
          version = "1.0.0"
          
          [tool.poetry.dependencies]
          app1 = { path = "apps/app1", develop = true }
          `,
          // Intentionally missing the dep1 dependency
        );

        tree.write(
          'apps/app1/pyproject.toml',
          dedent`
          [tool.poetry]
          name = "app1"
          version = "1.0.0"

          [tool.poetry.dependencies]
          dep1 = { path = "../../libs/dep1", develop = true }
          `,
        );
        tree.write(
          'libs/dep1/pyproject.toml',
          dedent`
          [tool.poetry]
          name = "dep1"
          version = "1.0.0"
          `,
        );

        mocks.createProjectGraphAsync.mockResolvedValue(projectGraph);
        const result = await syncGenerator(tree);

        assert(result, 'result is not defined');
        expect(result).toBeDefined();
        expect(result).toBeTypeOf('object');
        expect(result.outOfSyncMessage).toBe(
          'Root pyproject.toml is out of sync. Missing dependency: dep1\n',
        );
        expect(result.callback).toBeDefined();

        await result.callback();

        expect(checkPoetryExecutableMock).toHaveBeenCalled();
        expect(activateVenvMock).toHaveBeenCalledWith(tree.root, false, {
          ...context,
          projectName: 'app1',
        });

        expect(spawn.sync).toHaveBeenCalledTimes(2);
        expect(spawn.sync).toHaveBeenNthCalledWith(
          1,
          'poetry',
          ['lock', '--no-update'],
          {
            shell: false,
            stdio: 'inherit',
          },
        );
        expect(spawn.sync).toHaveBeenNthCalledWith(
          2,
          'poetry',
          ['install', '--no-root', '-v'],
          {
            shell: false,
            stdio: 'inherit',
          },
        );

        expect(tree.read('pyproject.toml', 'utf-8')).toMatchSnapshot();
      });
    });
  });
  describe('uv', () => {
    let checkPrerequisites: MockInstance;

    beforeEach(() => {
      const nxJson: NxJsonConfiguration = {
        plugins: [
          {
            plugin: '@nxlv/python',
            options: {
              packageManager: 'uv',
            },
          },
        ],
      };
      tree.write('nx.json', JSON.stringify(nxJson));
      baseContext.nxJsonConfiguration = nxJson;

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

    describe('project', () => {
      it('should sync a project with a missing dependency', async () => {
        const projectGraph: ProjectGraph = {
          nodes: {
            app1: {
              name: 'app1',
              type: 'app',
              data: {
                root: 'apps/app1',
                targets: {},
              },
            },
            dep1: {
              name: 'dep1',
              type: 'lib',
              data: {
                root: 'libs/dep1',
                targets: {},
              },
            },
          },
          dependencies: {
            app1: [
              {
                target: 'dep1',
                source: 'app1',
                type: DependencyType.dynamic,
              },
            ],
          },
        };

        tree.write(
          'apps/app1/pyproject.toml',
          dedent`
          [project]
          name = "app1"
          version = "1.0.0"
          dependencies = []
          `,
          // Intentionally missing the dep1 dependency
        );
        tree.write(
          'libs/dep1/pyproject.toml',
          dedent`
          [project]
          name = "dep1"
          version = "1.0.0"
          dependencies = []
          `,
        );

        mocks.createProjectGraphAsync.mockResolvedValue(projectGraph);
        const result = await syncGenerator(tree);

        assert(result, 'result is not defined');
        expect(result).toBeDefined();
        expect(result).toBeTypeOf('object');
        expect(result.outOfSyncMessage).toBe(
          'Project app1 is out of sync. Missing dependencies: dep1\n',
        );
        expect(result.callback).toBeDefined();

        await result.callback();

        expect(checkPrerequisites).toHaveBeenCalled();

        expect(spawn.sync).toHaveBeenCalledTimes(1);
        expect(spawn.sync).toHaveBeenNthCalledWith(1, 'uv', ['sync'], {
          cwd: 'apps/app1',
          shell: false,
          stdio: 'inherit',
        });

        expect(
          tree.read('apps/app1/pyproject.toml', 'utf-8'),
        ).toMatchSnapshot();
      });

      it('should sync a project with a missing dependency with dependents', async () => {
        const projectGraph: ProjectGraph = {
          nodes: {
            app1: {
              name: 'app1',
              type: 'app',
              data: {
                root: 'apps/app1',
                targets: {},
              },
            },
            dep1: {
              name: 'dep1',
              type: 'lib',
              data: {
                root: 'libs/dep1',
                targets: {},
              },
            },
            dep2: {
              name: 'dep2',
              type: 'lib',
              data: {
                root: 'libs/dep2',
                targets: {},
              },
            },
          },
          dependencies: {
            app1: [
              {
                target: 'dep1',
                source: 'app1',
                type: DependencyType.implicit,
              },
            ],
            dep1: [
              {
                target: 'dep2',
                source: 'dep1',
                type: DependencyType.dynamic,
              },
            ],
          },
        };

        tree.write(
          'apps/app1/pyproject.toml',
          dedent`
          [project]
          name = "app1"
          version = "1.0.0"
          dependencies = [
            "dep1",
          ]

          [tool.uv.sources]
          dep1 = { path = "../../libs/dep1" }
          `,
        );
        tree.write(
          'libs/dep1/pyproject.toml',
          dedent`
          [project]
          name = "dep1"
          version = "1.0.0"
          dependencies = []
          `,
          // Intentionally missing the dep2 dependency
        );
        tree.write(
          'libs/dep2/pyproject.toml',
          dedent`
          [project]
          name = "dep2"
          version = "1.0.0"
          dependencies = []
          `,
        );

        mocks.createProjectGraphAsync.mockResolvedValue(projectGraph);
        const result = await syncGenerator(tree);

        assert(result, 'result is not defined');
        expect(result).toBeDefined();
        expect(result).toBeTypeOf('object');
        expect(result.outOfSyncMessage).toBe(
          'Project dep1 is out of sync. Missing dependencies: dep2\n',
        );
        expect(result.callback).toBeDefined();

        await result.callback();

        expect(checkPrerequisites).toHaveBeenCalled();

        expect(spawn.sync).toHaveBeenCalledTimes(2);
        expect(spawn.sync).toHaveBeenNthCalledWith(1, 'uv', ['sync'], {
          cwd: 'libs/dep1',
          shell: false,
          stdio: 'inherit',
        });
        expect(spawn.sync).toHaveBeenNthCalledWith(2, 'uv', ['sync'], {
          cwd: 'apps/app1',
          shell: false,
          stdio: 'inherit',
        });

        expect(
          tree.read('libs/dep1/pyproject.toml', 'utf-8'),
        ).toMatchSnapshot();
      });
    });

    describe('workspace', () => {
      it('should sync a project with a missing dependency', async () => {
        const projectGraph: ProjectGraph = {
          nodes: {
            app1: {
              name: 'app1',
              type: 'app',
              data: {
                root: 'apps/app1',
                targets: {},
              },
            },
            dep1: {
              name: 'dep1',
              type: 'lib',
              data: {
                root: 'libs/dep1',
                targets: {},
              },
            },
          },
          dependencies: {
            app1: [
              {
                target: 'dep1',
                source: 'app1',
                type: DependencyType.dynamic,
              },
            ],
          },
        };

        tree.write(
          'pyproject.toml',
          dedent`
          [project]
          name = "workspace"
          version = "1.0.0"
          dependencies = [
            "app1",
          ]

          [tool.uv.workspace]
          members = [
            "apps/app1",
          ]

          [tool.uv.sources]
          app1 = { workspace = true }
          `,
          // Intentionally missing the dep1 dependency
        );
        tree.write(
          'uv.lock',
          dedent`
        [[package]]
        name = "app1"
        version = "1.0.0"
        source = { editable = "apps/app1" }
        dependencies = []
        `,
        );

        tree.write(
          'apps/app1/pyproject.toml',
          dedent`
          [project]
          name = "app1"
          version = "1.0.0"
          dependencies = []
          `,
          // Intentionally missing the dep1 dependency
        );
        tree.write(
          'libs/dep1/pyproject.toml',
          dedent`
          [project]
          name = "dep1"
          version = "1.0.0"
          dependencies = []
          `,
        );

        mocks.createProjectGraphAsync.mockResolvedValue(projectGraph);
        const result = await syncGenerator(tree);

        assert(result, 'result is not defined');
        expect(result).toBeDefined();
        expect(result).toBeTypeOf('object');
        expect(result.outOfSyncMessage).toBe(
          'Project app1 is out of sync. Missing dependencies: dep1\n' +
            'Root pyproject.toml is out of sync. Missing dependency: dep1\n' +
            'Root pyproject.toml is out of sync. Missing source: dep1\n' +
            'Root pyproject.toml is out of sync. Missing workspace member: libs/dep1\n',
        );
        expect(result.callback).toBeDefined();

        await result.callback();

        expect(checkPrerequisites).toHaveBeenCalled();

        expect(spawn.sync).toHaveBeenCalledTimes(1);
        expect(spawn.sync).toHaveBeenNthCalledWith(1, 'uv', ['sync'], {
          shell: false,
          stdio: 'inherit',
        });

        expect(
          tree.read('apps/app1/pyproject.toml', 'utf-8'),
        ).toMatchSnapshot();
        expect(tree.read('pyproject.toml', 'utf-8')).toMatchSnapshot();
      });

      it('should sync a project with a missing dependency with dependents', async () => {
        const projectGraph: ProjectGraph = {
          nodes: {
            app1: {
              name: 'app1',
              type: 'app',
              data: {
                root: 'apps/app1',
                targets: {},
              },
            },
            dep1: {
              name: 'dep1',
              type: 'lib',
              data: {
                root: 'libs/dep1',
                targets: {},
              },
            },
            dep2: {
              name: 'dep2',
              type: 'lib',
              data: {
                root: 'libs/dep2',
                targets: {},
              },
            },
          },
          dependencies: {
            app1: [
              {
                target: 'dep1',
                source: 'app1',
                type: DependencyType.implicit,
              },
            ],
            dep1: [
              {
                target: 'dep2',
                source: 'dep1',
                type: DependencyType.dynamic,
              },
            ],
          },
        };

        tree.write(
          'pyproject.toml',
          dedent`
          [project]
          name = "workspace"
          version = "1.0.0"
          dependencies = [
            "app1",
            "dep1",
          ]

          [tool.uv.workspace]
          members = [
            "apps/app1",
            "libs/dep1",
          ]

          [tool.uv.sources]
          app1 = { workspace = true }
          dep1 = { workspace = true }
          `,
          // Intentionally missing the dep2 dependency
        );
        tree.write(
          'uv.lock',
          dedent`
        [[package]]
        name = "app1"
        version = "1.0.0"
        source = { editable = "apps/app1" }
        dependencies = [
          { name = "dep1" },
        ]
        
        [package.metadata]
        requires-dist = [
            { name = "dep1", editable = "libs/dep1" },
        ]

        [[package]]
        name = "dep1"
        version = "1.0.0"
        source = { editable = "libs/dep1" }
        dependencies = []

        [[package]]
        name = "dep2"
        version = "1.0.0"
        source = { editable = "libs/dep2" }
        dependencies = []
        `,
        );

        tree.write(
          'apps/app1/pyproject.toml',
          dedent`
          [project]
          name = "app1"
          version = "1.0.0"
          dependencies = [
            "dep1",
          ]

          [tool.uv.sources]
          dep1 = { workspace = true }
          `,
        );
        tree.write(
          'libs/dep1/pyproject.toml',
          dedent`
          [project]
          name = "dep1"
          version = "1.0.0"
          dependencies = []
          `,
        );
        tree.write(
          'libs/dep2/pyproject.toml',
          dedent`
          [project]
          name = "dep2"
          version = "1.0.0"
          dependencies = []
          `,
        );

        mocks.createProjectGraphAsync.mockResolvedValue(projectGraph);
        const result = await syncGenerator(tree);

        assert(result, 'result is not defined');
        expect(result).toBeDefined();
        expect(result).toBeTypeOf('object');
        expect(result.outOfSyncMessage).toBe(
          'Project dep1 is out of sync. Missing dependencies: dep2\n' +
            'Root pyproject.toml is out of sync. Missing dependency: dep2\n' +
            'Root pyproject.toml is out of sync. Missing source: dep2\n' +
            'Root pyproject.toml is out of sync. Missing workspace member: libs/dep2\n',
        );
        expect(result.callback).toBeDefined();

        await result.callback();

        expect(checkPrerequisites).toHaveBeenCalled();

        expect(spawn.sync).toHaveBeenCalledTimes(1);
        expect(spawn.sync).toHaveBeenNthCalledWith(1, 'uv', ['sync'], {
          shell: false,
          stdio: 'inherit',
        });

        expect(
          tree.read('libs/dep1/pyproject.toml', 'utf-8'),
        ).toMatchSnapshot();
        expect(tree.read('pyproject.toml', 'utf-8')).toMatchSnapshot();
      });

      it('should only sync the root project when there are no missing dependencies', async () => {
        const projectGraph: ProjectGraph = {
          nodes: {
            app1: {
              name: 'app1',
              type: 'app',
              data: {
                root: 'apps/app1',
                targets: {},
              },
            },
            dep1: {
              name: 'dep1',
              type: 'lib',
              data: {
                root: 'libs/dep1',
                targets: {},
              },
            },
          },
          dependencies: {
            app1: [
              {
                target: 'dep1',
                source: 'app1',
                type: DependencyType.implicit,
              },
            ],
          },
        };

        tree.write(
          'pyproject.toml',
          dedent`
          [project]
          name = "workspace"
          version = "1.0.0"

          dependencies = [
            "app1",
          ]

          [tool.uv.workspace]
          members = [
            "apps/app1",
          ]

          [tool.uv.sources]
          app1 = { workspace = true }
          `,
          // Intentionally missing the dep1 dependency
        );

        tree.write(
          'uv.lock',
          dedent`
          [[package]]
          name = "app1"
          version = "1.0.0"
          source = { editable = "apps/app1" }
          dependencies = [
            { name = "dep1" },
          ]

          [package.metadata]
          requires-dist = [
            { name = "dep1", editable = "libs/dep1" },
          ]

          [[package]]
          name = "dep1"
          version = "1.0.0"
          source = { editable = "libs/dep1" }
          dependencies = []
          `,
        );

        tree.write(
          'apps/app1/pyproject.toml',
          dedent`
          [project]
          name = "app1"
          version = "1.0.0"
          dependencies = [
            "dep1",
          ]

          [tool.uv.sources]
          dep1 = { workspace = true }
          `,
        );
        tree.write(
          'libs/dep1/pyproject.toml',
          dedent`
          [project]
          name = "dep1"
          version = "1.0.0"
          dependencies = []
          `,
        );

        mocks.createProjectGraphAsync.mockResolvedValue(projectGraph);
        const result = await syncGenerator(tree);

        assert(result, 'result is not defined');
        expect(result).toBeDefined();
        expect(result).toBeTypeOf('object');
        expect(result.outOfSyncMessage).toBe(
          'Root pyproject.toml is out of sync. Missing dependency: dep1\n' +
            'Root pyproject.toml is out of sync. Missing source: dep1\n' +
            'Root pyproject.toml is out of sync. Missing workspace member: libs/dep1\n',
        );
        expect(result.callback).toBeDefined();

        await result.callback();

        expect(checkPrerequisites).toHaveBeenCalled();

        expect(spawn.sync).toHaveBeenCalledTimes(1);
        expect(spawn.sync).toHaveBeenNthCalledWith(1, 'uv', ['sync'], {
          shell: false,
          stdio: 'inherit',
        });

        expect(tree.read('pyproject.toml', 'utf-8')).toMatchSnapshot();
      });
    });
  });
});

function parseProjectGraphToConfig(
  projectGraph: ProjectGraph,
): Record<string, ProjectConfiguration> {
  return Object.entries(projectGraph.nodes).reduce<
    Record<string, ProjectConfiguration>
  >((acc, [project, node]) => {
    acc[project] = node.data;
    return acc;
  }, {});
}
