import '../utils/mocks/fs.mock';
import { createDependencies, getDependents } from './dependency-graph';
import { vol } from 'memfs';

import dedent from 'string-dedent';

describe('nx-python dependency graph', () => {
  afterEach(() => {
    vol.reset();
  });

  describe('dependency graph', () => {
    it('should progress the dependency graph', async () => {
      vol.fromJSON({
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

      const result = createDependencies(null, {
        externalNodes: {},
        workspaceRoot: '.',
        projects,
        nxJsonConfiguration: {},
        fileMap: {
          nonProjectFiles: [],
          projectFileMap: {},
        },
        filesToProcess: {
          nonProjectFiles: [],
          projectFileMap: {},
        },
      });

      expect(result).toStrictEqual([
        {
          source: 'app1',
          target: 'dep1',
          type: 'implicit',
        },
      ]);
    });

    it('should link dev dependencies in the graph', async () => {
      vol.fromJSON({
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

      const result = createDependencies(null, {
        externalNodes: {},
        workspaceRoot: '.',
        projects,
        nxJsonConfiguration: {},
        fileMap: {
          nonProjectFiles: [],
          projectFileMap: {},
        },
        filesToProcess: {
          nonProjectFiles: [],
          projectFileMap: {},
        },
      });

      expect(result).toStrictEqual([
        {
          source: 'app1',
          target: 'dep1',
          type: 'implicit',
        },
      ]);
    });

    it('should link arbitrary groups dependencies in the graph', async () => {
      vol.fromJSON({
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

      const result = createDependencies(null, {
        externalNodes: {},
        workspaceRoot: '.',
        projects,
        nxJsonConfiguration: {},
        fileMap: {
          nonProjectFiles: [],
          projectFileMap: {},
        },
        filesToProcess: {
          nonProjectFiles: [],
          projectFileMap: {},
        },
      });

      expect(result).toStrictEqual([
        {
          source: 'app1',
          target: 'dep1',
          type: 'implicit',
        },
      ]);
    });

    it('should progress the dependency graph for an empty project', async () => {
      const result = createDependencies(null, {
        externalNodes: {},
        workspaceRoot: '.',
        projects: {},
        nxJsonConfiguration: {},
        fileMap: {
          nonProjectFiles: [],
          projectFileMap: {},
        },
        filesToProcess: {
          nonProjectFiles: [],
          projectFileMap: {},
        },
      });

      expect(result).toStrictEqual([]);
    });

    it('should progress the dependency graph when there is an app that is not managed by @nxlv/python', async () => {
      vol.fromJSON({
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

      const result = createDependencies(null, {
        externalNodes: {},
        workspaceRoot: '.',
        projects,
        nxJsonConfiguration: {},
        fileMap: {
          nonProjectFiles: [],
          projectFileMap: {},
        },
        filesToProcess: {
          nonProjectFiles: [],
          projectFileMap: {},
        },
      });

      expect(result).toStrictEqual([
        {
          source: 'app1',
          target: 'dep1',
          type: 'implicit',
        },
      ]);
    });

    it('should progress the dependency graph when there is an app with an empty pyproject.toml', async () => {
      vol.fromJSON({
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

      const result = createDependencies(null, {
        externalNodes: {},
        workspaceRoot: '.',
        projects,
        nxJsonConfiguration: {},
        fileMap: {
          nonProjectFiles: [],
          projectFileMap: {},
        },
        filesToProcess: {
          nonProjectFiles: [],
          projectFileMap: {},
        },
      });

      expect(result).toStrictEqual([
        {
          source: 'app1',
          target: 'dep1',
          type: 'implicit',
        },
      ]);
    });
  });

  describe('get dependents', () => {
    it('should return the dependent projects', () => {
      vol.fromJSON({
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

      const result = getDependents('dep1', projects, '.');

      expect(result).toStrictEqual(['app1']);
    });

    it('should return not throw an error when the pyproject is invalid or empty', () => {
      vol.fromJSON({
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

      const result = getDependents('dep1', projects, '.');

      expect(result).toStrictEqual([]);
    });
  });
});
