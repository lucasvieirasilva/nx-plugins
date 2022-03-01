import { processProjectGraph } from './dependency-graph';
import fsMock from 'mock-fs';
import { ProjectGraphBuilder } from '@nrwl/devkit';

describe('nx-python dependency graph', () => {
  afterEach(() => {
    fsMock.restore();
  });

  it('should progress the dependency graph', async () => {
    fsMock({
      'apps/app1/pyproject.toml': `[tool.poetry]
name = "app1"
version = "1.0.0"
  [tool.poetry.dependencies]
  python = "^3.8"
  dep1 = { path = "../../libs/dep1" }`,
      'libs/dep1/pyproject.toml': `[tool.poetry]
      name = "dep1"
      version = "1.0.0"
        [tool.poetry.dependencies]
        python = "^3.8"`,
      'libs/dep2/pyproject.toml': `[tool.poetry]
        name = "dep2"
        version = "1.0.0"
          [tool.poetry.dependencies]
          python = "^3.8"`,
    });

    const mockBuilder = new ProjectGraphBuilder(null);

    mockBuilder.addNode({
      name: 'app1',
      type: 'app',
      data: {},
    });

    mockBuilder.addNode({
      name: 'dep1',
      type: 'lib',
      data: {},
    });

    const result = processProjectGraph(mockBuilder.graph, {
      fileMap: {},
      filesToProcess: {},
      workspace: {
        projects: {
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
        },
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
        dep1: [],
      },
      externalNodes: {},
      nodes: {
        app1: {
          name: 'app1',
          type: 'app',
          data: {},
        },
        dep1: {
          name: 'dep1',
          type: 'lib',
          data: {},
        },
      },
    });
  });

  it('should progress the dependency graph for an empty project', async () => {
    const result = processProjectGraph(null, {
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
});
