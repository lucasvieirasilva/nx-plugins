import { processProjectGraph, getDependents } from './dependency-graph';
import fsMock from 'mock-fs';
import { ProjectGraphBuilder } from '@nrwl/devkit';
import dedent from 'string-dedent';

describe('nx-python dependency graph', () => {
  afterEach(() => {
    fsMock.restore();
  });

  describe('dependency graph', () => {
    it('should progress the dependency graph', async () => {
      fsMock({
        'apps/app1/pyproject.toml': dedent`
      [tool.poetry]
      name = "app1"
      version = "1.0.0"
        [tool.poetry.dependencies]
        python = "^3.8"
        dep1 = { path = "../../libs/dep1" }
      `,

        'libs/dep1/pyproject.toml': dedent`
      [tool.poetry]
      name = "dep1"
      version = "1.0.0"
        [tool.poetry.dependencies]
        python = "^3.8"
      `,
        'libs/dep2/pyproject.toml': dedent`
      [tool.poetry]
      name = "dep2"
      version = "1.0.0"
        [tool.poetry.dependencies]
        python = "^3.8"

        [tool.poetry.group.dev.dependencies]
        pytest = "6.2.4"
      `,
      });

      const mockBuilder = new ProjectGraphBuilder(null);

      mockBuilder.addNode({
        name: 'app1',
        type: 'app',
        data: {
          root: 'apps/app1',
          files: [],
        },
      });

      mockBuilder.addNode({
        name: 'dep1',
        type: 'lib',
        data: {
          root: 'libs/dep1',
          files: [],
        },
      });

      const projects = {
        app1: {
          root: 'apps/app1',
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
        dep3: {
          root: 'libs/dep3',
          targets: {},
        },
      };

      const result = processProjectGraph(mockBuilder.graph, {
        projectsConfigurations: {
          projects,
          version: 2,
        },
        nxJsonConfiguration: {},
        fileMap: {},
        filesToProcess: {},
        workspace: {
          projects,
          version: 2,
          npmScope: 'test',
        },
      });

      expect(result).toStrictEqual({
        dependencies: {
          app1: [
            {
              source: 'app1',
              target: 'dep1',
              type: 'implicit',
            },
          ],
        },
        externalNodes: {},
        nodes: {
          app1: {
            name: 'app1',
            type: 'app',
            data: {
              root: 'apps/app1',
              files: [],
            },
          },
          dep1: {
            name: 'dep1',
            type: 'lib',
            data: {
              root: 'libs/dep1',
              files: [],
            },
          },
        },
      });
    });

    it('should link dev dependencies in the graph', async () => {
      fsMock({
        'apps/app1/pyproject.toml': dedent`
      [tool.poetry]
      name = "app1"
      version = "1.0.0"
        [tool.poetry.group.dev.dependencies]
        python = "^3.8"
        dep1 = { path = "../../libs/dep1" }
      `,

        'libs/dep1/pyproject.toml': dedent`
      [tool.poetry]
      name = "dep1"
      version = "1.0.0"
        [tool.poetry.dependencies]
        python = "^3.8"
      `,
      });

      const mockBuilder = new ProjectGraphBuilder(null);

      mockBuilder.addNode({
        name: 'app1',
        type: 'app',
        data: {
          root: 'apps/app1',
          files: [],
        },
      });

      mockBuilder.addNode({
        name: 'dep1',
        type: 'lib',
        data: {
          root: 'libs/dep1',
          files: [],
        },
      });

      const projects = {
        app1: {
          root: 'apps/app1',
          targets: {},
        },
        dep1: {
          root: 'libs/dep1',
          targets: {},
        },
      };

      const result = processProjectGraph(mockBuilder.graph, {
        projectsConfigurations: {
          projects,
          version: 2,
        },
        nxJsonConfiguration: {},
        fileMap: {},
        filesToProcess: {},
        workspace: {
          projects,
          version: 2,
          npmScope: 'test',
        },
      });

      expect(result).toStrictEqual({
        dependencies: {
          app1: [
            {
              source: 'app1',
              target: 'dep1',
              type: 'implicit',
            },
          ],
        },
        externalNodes: {},
        nodes: {
          app1: {
            name: 'app1',
            type: 'app',
            data: {
              root: 'apps/app1',
              files: [],
            },
          },
          dep1: {
            name: 'dep1',
            type: 'lib',
            data: {
              root: 'libs/dep1',
              files: [],
            },
          },
        },
      });
    });

    it('should link arbitrary groups dependencies in the graph', async () => {
      fsMock({
        'apps/app1/pyproject.toml': dedent`
      [tool.poetry]
      name = "app1"
      version = "1.0.0"
        [tool.poetry.group.example_group.dependencies]
        python = "^3.8"
        dep1 = { path = "../../libs/dep1" }
      `,

        'libs/dep1/pyproject.toml': dedent`
      [tool.poetry]
      name = "dep1"
      version = "1.0.0"
        [tool.poetry.dependencies]
        python = "^3.8"
      `,
      });

      const mockBuilder = new ProjectGraphBuilder(null);

      mockBuilder.addNode({
        name: 'app1',
        type: 'app',
        data: {
          root: 'apps/app1',
          files: [],
        },
      });

      mockBuilder.addNode({
        name: 'dep1',
        type: 'lib',
        data: {
          root: 'libs/dep1',
          files: [],
        },
      });

      const projects = {
        app1: {
          root: 'apps/app1',
          targets: {},
        },
        dep1: {
          root: 'libs/dep1',
          targets: {},
        },
      };

      const result = processProjectGraph(mockBuilder.graph, {
        projectsConfigurations: {
          projects,
          version: 2,
        },
        nxJsonConfiguration: {},
        fileMap: {},
        filesToProcess: {},
        workspace: {
          projects,
          version: 2,
          npmScope: 'test',
        },
      });

      expect(result).toStrictEqual({
        dependencies: {
          app1: [
            {
              source: 'app1',
              target: 'dep1',
              type: 'implicit',
            },
          ],
        },
        externalNodes: {},
        nodes: {
          app1: {
            name: 'app1',
            type: 'app',
            data: {
              root: 'apps/app1',
              files: [],
            },
          },
          dep1: {
            name: 'dep1',
            type: 'lib',
            data: {
              root: 'libs/dep1',
              files: [],
            },
          },
        },
      });
    });

    it('should progress the dependency graph for an empty project', async () => {
      const result = processProjectGraph(null, {
        projectsConfigurations: {
          projects: {},
          version: 2,
        },
        nxJsonConfiguration: {},
        fileMap: {},
        filesToProcess: {},
        workspace: {
          projects: {},
          version: 2,
          npmScope: 'test',
        },
      });

      expect(result).toStrictEqual({
        dependencies: {},
        externalNodes: {},
        nodes: {},
      });
    });

    it('should progress the dependency graph when there is an app that is not managed by @nxlv/python', async () => {
      fsMock({
        'apps/app1/pyproject.toml': dedent`
      [tool.poetry]
      name = "app1"
      version = "1.0.0"
        [tool.poetry.dependencies]
        python = "^3.8"
        dep1 = { path = "../../libs/dep1" }
      `,
        'apps/app2/pyproject.toml': dedent`
      [tool.poetry]
      name = "app2"
      version = "1.0.0"
        [tool.poetry.dependencies]
        python = "^3.8"
        dep3 = { path = "../../libs/dep3" }
      `,
        'libs/dep1/pyproject.toml': dedent`
      [tool.poetry]
      name = "dep1"
      version = "1.0.0"
        [tool.poetry.dependencies]
        python = "^3.8"
      `,
        'libs/dep2/pyproject.toml': dedent`
      [tool.poetry]
      name = "dep2"
      version = "1.0.0"
        [tool.poetry.dependencies]
        python = "^3.8"

        [tool.poetry.group.dev.dependencies]
        pytest = "6.2.4"
      `,
      });

      const mockBuilder = new ProjectGraphBuilder(null);

      mockBuilder.addNode({
        name: 'app1',
        type: 'app',
        data: {
          root: 'apps/app1',
          files: [],
        },
      });

      mockBuilder.addNode({
        name: 'app2',
        type: 'app',
        data: {
          root: 'apps/app2',
          files: [],
        },
      });

      mockBuilder.addNode({
        name: 'dep1',
        type: 'lib',
        data: {
          root: 'libs/dep1',
          files: [],
        },
      });

      const projects = {
        app1: {
          root: 'apps/app1',
          targets: {},
        },
        app2: {
          root: 'apps/app2',
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
      };

      const result = processProjectGraph(mockBuilder.graph, {
        projectsConfigurations: {
          projects,
          version: 2,
        },
        nxJsonConfiguration: {},
        fileMap: {},
        filesToProcess: {},
        workspace: {
          projects,
          version: 2,
          npmScope: 'test',
        },
      });

      expect(result).toStrictEqual({
        dependencies: {
          app1: [
            {
              source: 'app1',
              target: 'dep1',
              type: 'implicit',
            },
          ],
        },
        externalNodes: {},
        nodes: {
          app1: {
            name: 'app1',
            type: 'app',
            data: {
              root: 'apps/app1',
              files: [],
            },
          },
          app2: {
            name: 'app2',
            type: 'app',
            data: {
              root: 'apps/app2',
              files: [],
            },
          },
          dep1: {
            name: 'dep1',
            type: 'lib',
            data: {
              root: 'libs/dep1',
              files: [],
            },
          },
        },
      });
    });

    it('should progress the dependency graph when there is an app with an empty pyproject.toml', async () => {
      fsMock({
        'apps/app1/pyproject.toml': dedent`
      [tool.poetry]
      name = "app1"
      version = "1.0.0"
        [tool.poetry.dependencies]
        python = "^3.8"
        dep1 = { path = "../../libs/dep1" }
      `,
        'apps/app2/pyproject.toml': '',
        'libs/dep1/pyproject.toml': dedent`
      [tool.poetry]
      name = "dep1"
      version = "1.0.0"
        [tool.poetry.dependencies]
        python = "^3.8"
      `,
        'libs/dep2/pyproject.toml': dedent`
      [tool.poetry]
      name = "dep2"
      version = "1.0.0"
        [tool.poetry.dependencies]
        python = "^3.8"

        [tool.poetry.group.dev.dependencies]
        pytest = "6.2.4"
      `,
      });

      const mockBuilder = new ProjectGraphBuilder(null);

      mockBuilder.addNode({
        name: 'app1',
        type: 'app',
        data: {
          root: 'apps/app1',
          files: [],
        },
      });

      mockBuilder.addNode({
        name: 'app2',
        type: 'app',
        data: {
          root: 'apps/app2',
          files: [],
        },
      });

      mockBuilder.addNode({
        name: 'dep1',
        type: 'lib',
        data: {
          root: 'libs/dep1',
          files: [],
        },
      });

      const projects = {
        app1: {
          root: 'apps/app1',
          targets: {},
        },
        app2: {
          root: 'apps/app2',
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
        dep3: {
          root: 'libs/dep3',
          targets: {},
        },
      };

      const result = processProjectGraph(mockBuilder.graph, {
        projectsConfigurations: {
          projects,
          version: 2,
        },
        nxJsonConfiguration: {},
        fileMap: {},
        filesToProcess: {},
        workspace: {
          projects,
          version: 2,
          npmScope: 'test',
        },
      });

      expect(result).toStrictEqual({
        dependencies: {
          app1: [
            {
              source: 'app1',
              target: 'dep1',
              type: 'implicit',
            },
          ],
        },
        externalNodes: {},
        nodes: {
          app1: {
            name: 'app1',
            type: 'app',
            data: {
              root: 'apps/app1',
              files: [],
            },
          },
          app2: {
            name: 'app2',
            type: 'app',
            data: {
              root: 'apps/app2',
              files: [],
            },
          },
          dep1: {
            name: 'dep1',
            type: 'lib',
            data: {
              root: 'libs/dep1',
              files: [],
            },
          },
        },
      });
    });
  });

  describe('get dependents', () => {
    it('should return the dependent projects', () => {
      fsMock({
        'apps/app1/pyproject.toml': dedent`
      [tool.poetry]
      name = "app1"
      version = "1.0.0"
        [tool.poetry.dependencies]
        python = "^3.8"
        dep1 = { path = "../../libs/dep1" }
      `,
        'libs/dep1/pyproject.toml': dedent`
      [tool.poetry]
      name = "dep1"
      version = "1.0.0"
        [tool.poetry.dependencies]
        python = "^3.8"
      `,
      });

      const projects = {
        app1: {
          root: 'apps/app1',
          targets: {},
        },
        dep1: {
          root: 'libs/dep1',
          targets: {},
        },
      };

      const result = getDependents(
        'dep1',
        {
          projects,
          version: 2,
        },
        '.'
      );

      expect(result).toStrictEqual(['app1']);
    });

    it('should return not throw an error when the pyproject is invalid or empty', () => {
      fsMock({
        'apps/app1/pyproject.toml': '',
        'libs/dep1/pyproject.toml': dedent`
      [tool.poetry]
      name = "dep1"
      version = "1.0.0"
        [tool.poetry.dependencies]
        python = "^3.8"
      `,
      });

      const projects = {
        app1: {
          root: 'apps/app1',
          targets: {},
        },
        dep1: {
          root: 'libs/dep1',
          targets: {},
        },
      };

      const result = getDependents(
        'dep1',
        {
          projects,
          version: 2,
        },
        '.'
      );

      expect(result).toStrictEqual([]);
    });
  });
});
