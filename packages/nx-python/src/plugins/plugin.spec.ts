import '../utils/mocks/fs.mock';
import { getProvider } from '../provider';
import { createDependencies, createNodesV2 } from './plugin';
import { vol } from 'memfs';
import { ProjectGraphBuilder } from 'nx/src/project-graph/project-graph-builder';

import dedent from 'string-dedent';

describe('nx-python dependency graph', () => {
  afterEach(() => {
    vol.reset();
  });

  describe('poetry', () => {
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

        const result = await createDependencies(null, {
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

        const result = await createDependencies(null, {
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

        const result = await createDependencies(null, {
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
        const result = await createDependencies(null, {
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

        const result = await createDependencies(null, {
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

        const result = await createDependencies(null, {
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
      it('should return the dependent projects', async () => {
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

        const provider = await getProvider('.');
        const result = provider.getDependents('dep1', projects, '.');

        expect(result).toStrictEqual(['app1']);
      });

      it('should return not throw an error when the pyproject is invalid or empty', async () => {
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

        const provider = await getProvider('.');
        const result = provider.getDependents('dep1', projects, '.');

        expect(result).toStrictEqual([]);
      });
    });

    describe('infer dependencies', () => {
      it('should scan the project for modules that import other local projects', async () => {
        vol.fromJSON({
          'apps/app1/pyproject.toml': dedent`
          [tool.poetry]
          name = "app1"
          version = "1.0.0"
            [[tool.poetry.packages]]
            include = "app1"

            [tool.poetry.dependencies]
            python = "^3.8"
            dep3 = { path = "../../libs/dep3" }
          `,
          'apps/app1/app1/test1.py': dedent`
          import dep1
          `,
          'apps/app1/app1/test2.py': dedent`
          from dep2.test1 import test1
          `,
          'apps/app1/app1/test3.py': dedent`
          from dep3 import test2
          `,

          'libs/dep1/pyproject.toml': dedent`
          [tool.poetry]
          name = "dep1"
          version = "1.0.0"
            [[tool.poetry.packages]]
            include = "dep1"

            [tool.poetry.dependencies]
            python = "^3.8"
          `,
          'libs/dep2/pyproject.toml': dedent`
          [tool.poetry]
          name = "dep2"
          version = "1.0.0"
            [[tool.poetry.packages]]
            include = "dep2"

            [tool.poetry.dependencies]
            python = "^3.8"
          `,
          'libs/dep3/pyproject.toml': dedent`
          [tool.poetry]
          name = "dep3"
          version = "1.0.0"
            [[tool.poetry.packages]]
            include = "dep3"

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
          dep2: {
            root: 'libs/dep2',
            targets: {},
          },
          dep3: {
            root: 'libs/dep3',
            targets: {},
          },
        };

        const result = await createDependencies(
          {
            inferDependencies: true,
          },
          {
            externalNodes: {},
            workspaceRoot: '.',
            projects,
            nxJsonConfiguration: {},
            fileMap: {
              nonProjectFiles: [],
              projectFileMap: {
                app1: [
                  { file: 'apps/app1/app1/test1.py', hash: 'a' },
                  { file: 'apps/app1/app1/test2.py', hash: 'b' },
                  { file: 'apps/app1/app1/test3.py', hash: 'c' },
                ],
              },
            },
            filesToProcess: {
              nonProjectFiles: [],
              projectFileMap: {
                app1: [
                  { file: 'apps/app1/app1/test1.py', hash: 'a' },
                  { file: 'apps/app1/app1/test2.py', hash: 'b' },
                  { file: 'apps/app1/app1/test3.py', hash: 'c' },
                ],
              },
            },
          },
        );

        expect(result).toStrictEqual([
          {
            source: 'app1',
            target: 'dep3',
            type: 'implicit',
          },
          {
            source: 'app1',
            target: 'dep1',
            type: 'dynamic',
            sourceFile: 'apps/app1/app1/test1.py',
          },
          {
            source: 'app1',
            target: 'dep2',
            type: 'dynamic',
            sourceFile: 'apps/app1/app1/test2.py',
          },
        ]);
      });

      it('should parse imports with tree-sitter (multi-imports, aliases, ignoring comments and strings)', async () => {
        vol.fromJSON({
          'apps/app1/pyproject.toml': dedent`
          [tool.poetry]
          name = "app1"
          version = "1.0.0"
            [[tool.poetry.packages]]
            include = "app1"

            [tool.poetry.dependencies]
            python = "^3.8"
          `,
          'apps/app1/app1/imports.py': dedent`
          import dep1, dep2.submod
          import dep3 as renamed
          # import dep4
          example = "import dep4"
          `,

          'libs/dep1/pyproject.toml': dedent`
          [tool.poetry]
          name = "dep1"
          version = "1.0.0"
            [[tool.poetry.packages]]
            include = "dep1"

            [tool.poetry.dependencies]
            python = "^3.8"
          `,
          'libs/dep2/pyproject.toml': dedent`
          [tool.poetry]
          name = "dep2"
          version = "1.0.0"
            [[tool.poetry.packages]]
            include = "dep2"

            [tool.poetry.dependencies]
            python = "^3.8"
          `,
          'libs/dep3/pyproject.toml': dedent`
          [tool.poetry]
          name = "dep3"
          version = "1.0.0"
            [[tool.poetry.packages]]
            include = "dep3"

            [tool.poetry.dependencies]
            python = "^3.8"
          `,
          'libs/dep4/pyproject.toml': dedent`
          [tool.poetry]
          name = "dep4"
          version = "1.0.0"
            [[tool.poetry.packages]]
            include = "dep4"

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
          dep2: {
            root: 'libs/dep2',
            targets: {},
          },
          dep3: {
            root: 'libs/dep3',
            targets: {},
          },
          dep4: {
            root: 'libs/dep4',
            targets: {},
          },
        };

        const result = await createDependencies(
          {
            inferDependencies: true,
          },
          {
            externalNodes: {},
            workspaceRoot: '.',
            projects,
            nxJsonConfiguration: {},
            fileMap: {
              nonProjectFiles: [],
              projectFileMap: {
                app1: [{ file: 'apps/app1/app1/imports.py', hash: 'a' }],
              },
            },
            filesToProcess: {
              nonProjectFiles: [],
              projectFileMap: {
                app1: [{ file: 'apps/app1/app1/imports.py', hash: 'a' }],
              },
            },
          },
        );

        // `dep1` and `dep2` come from a single multi-import statement, `dep3`
        // from an aliased import. `dep4` only appears in a comment and a
        // string literal, so the tree-sitter parser correctly ignores it
        // (unlike the previous regex-based approach).
        expect(result).toStrictEqual([
          {
            source: 'app1',
            target: 'dep1',
            type: 'dynamic',
            sourceFile: 'apps/app1/app1/imports.py',
          },
          {
            source: 'app1',
            target: 'dep2',
            type: 'dynamic',
            sourceFile: 'apps/app1/app1/imports.py',
          },
          {
            source: 'app1',
            target: 'dep3',
            type: 'dynamic',
            sourceFile: 'apps/app1/app1/imports.py',
          },
        ]);
      });
    });
  });

  describe('uv', () => {
    describe('dependency graph', () => {
      it('should progress the dependency graph', async () => {
        vol.fromJSON({
          'apps/app1/pyproject.toml': dedent`
          [project]
          name = "app1"
          version = "0.1.0"
          readme = "README.md"
          requires-python = ">=3.12"
          dependencies = [
              "dep1",
          ]

          [tool.hatch.build.targets.wheel]
          packages = ["app1"]

          [dependency-groups]
          dev = [
              "flake8>=7.1.1",
              "ruff>=0.8.2",
          ]

          [tool.uv.sources]
          dep1 = { workspace = true }
          `,

          'libs/dep1/pyproject.toml': dedent`
          [project]
          name = "dep1"
          version = "0.1.0"
          readme = "README.md"
          requires-python = ">=3.12"
          dependencies = []
          `,

          'libs/dep2/pyproject.toml': dedent`
          [project]
          name = "dep2"
          version = "0.1.0"
          readme = "README.md"
          requires-python = ">=3.12"
          dependencies = []
          `,

          'pyproject.toml': '',

          'uv.lock': dedent`
          version = 1
          requires-python = ">=3.12"

          [[package]]
          name = "app1"
          version = "0.1.0"
          source = { editable = "apps/app1" }
          dependencies = [
              { name = "dep1" },
          ]

          [package.dev-dependencies]
          dev = [
              { name = "flake8" },
              { name = "ruff" },
          ]

          [package.metadata]
          requires-dist = [
              { name = "dep1", editable = "libs/dep1" },
          ]

          [package.metadata.requires-dev]
          dev = [
              { name = "flake8", specifier = ">=7.1.1" },
              { name = "ruff", specifier = ">=0.8.2" },
          ]
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

        const result = await createDependencies(null, {
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
          [project]
          name = "app1"
          version = "0.1.0"
          readme = "README.md"
          requires-python = ">=3.12"
          dependencies = []

          [tool.hatch.build.targets.wheel]
          packages = ["app1"]

          [dependency-groups]
          dev = [
              "flake8>=7.1.1",
              "ruff>=0.8.2",
              "dep1"
          ]

          [tool.uv.sources]
          dep1 = { workspace = true }
          `,

          'libs/dep1/pyproject.toml': dedent`
          [project]
          name = "dep1"
          version = "0.1.0"
          readme = "README.md"
          requires-python = ">=3.12"
          dependencies = []

          [tool.hatch.build.targets.wheel]
          packages = ["dep1"]
          `,

          'pyproject.toml': '',

          'uv.lock': dedent`
          version = 1
          requires-python = ">=3.12"

          [[package]]
          name = "app1"
          version = "0.1.0"
          source = { editable = "apps/app1" }
          dependencies = []

          [package.dev-dependencies]
          dev = [
              { name = "flake8" },
              { name = "ruff" },
              { name = "dep1" },
          ]

          [package.metadata]
          requires-dist = []

          [package.metadata.requires-dev]
          dev = [
              { name = "flake8", specifier = ">=7.1.1" },
              { name = "ruff", specifier = ">=0.8.2" },
              { name = "dep1", editable = "libs/dep1" },
          ]
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

        const result = await createDependencies(null, {
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

      it('should link optional-dependencies (extras) in the graph', async () => {
        vol.fromJSON({
          'apps/app1/pyproject.toml': dedent`
          [project]
          name = "app1"
          version = "0.1.0"
          readme = "README.md"
          requires-python = ">=3.12"
          dependencies = []

          [project.optional-dependencies]
          extra1 = [
              "dep1",
          ]

          [tool.hatch.build.targets.wheel]
          packages = ["app1"]

          [tool.uv.sources]
          dep1 = { workspace = true }
          `,

          'libs/dep1/pyproject.toml': dedent`
          [project]
          name = "dep1"
          version = "0.1.0"
          readme = "README.md"
          requires-python = ">=3.12"
          dependencies = []

          [tool.hatch.build.targets.wheel]
          packages = ["dep1"]
          `,

          'pyproject.toml': '',

          'uv.lock': dedent`
          version = 1
          requires-python = ">=3.12"

          [[package]]
          name = "app1"
          version = "0.1.0"
          source = { editable = "apps/app1" }
          dependencies = []

          [package.optional-dependencies]
          extra1 = [
              { name = "dep1" },
          ]

          [package.metadata]
          requires-dist = [
              { name = "dep1", editable = "libs/dep1", marker = "extra == 'extra1'" },
          ]
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

        const result = await createDependencies(null, {
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
          [project]
          name = "app1"
          version = "0.1.0"
          readme = "README.md"
          requires-python = ">=3.12"
          dependencies = []

          [tool.hatch.build.targets.wheel]
          packages = ["app1"]

          [dependency-groups]
          dev = [
              "flake8>=7.1.1",
              "ruff>=0.8.2",
          ]
          other = [
              "dep1",
          ]

          [tool.uv.sources]
          dep1 = { workspace = true }
          `,

          'libs/dep1/pyproject.toml': dedent`
          [project]
          name = "dep1"
          version = "0.1.0"
          readme = "README.md"
          requires-python = ">=3.12"
          dependencies = []

          [tool.hatch.build.targets.wheel]
          packages = ["dep1"]
          `,

          'pyproject.toml': '',

          'uv.lock': dedent`
          version = 1
          requires-python = ">=3.12"

          [[package]]
          name = "app1"
          version = "0.1.0"
          source = { editable = "apps/app1" }
          dependencies = [

          ]

          [package.dev-dependencies]
          dev = [
              { name = "flake8" },
              { name = "ruff" },
          ]
          other = [
              { name = "dep1" },
          ]

          [package.metadata]
          requires-dist = []

          [package.metadata.requires-dev]
          dev = [
              { name = "flake8", specifier = ">=7.1.1" },
              { name = "ruff", specifier = ">=0.8.2" },
          ]
          other = [
              { name = "dep1", editable = "libs/dep1" },
          ]
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

        const result = await createDependencies(null, {
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

      it('should read sources from root pyproject.toml', async () => {
        vol.fromJSON({
          'apps/app1/pyproject.toml': dedent`
          [project]
          name = "app1"
          version = "0.1.0"
          readme = "README.md"
          requires-python = ">=3.12"
          dependencies = ["dep1"]

          [tool.hatch.build.targets.wheel]
          packages = ["app1"]
          `,

          'libs/dep1/pyproject.toml': dedent`
          [project]
          name = "dep1"
          version = "0.1.0"
          readme = "README.md"
          requires-python = ">=3.12"
          dependencies = []

          [tool.hatch.build.targets.wheel]
          packages = ["dep1"]
          `,

          'pyproject.toml': dedent`
          [tool.uv.sources]
          app1 = { workspace = true }
          dep1 = { workspace = true }
          `,

          'uv.lock': dedent`
          version = 1
          requires-python = ">=3.12"

          [[package]]
          name = "app1"
          version = "0.1.0"
          source = { editable = "apps/app1" }
          dependencies = [
              { name = "dep1" },
          ]

          [package.metadata]
          requires-dist = [
              { name = "dep1", editable = "libs/dep1" },
          ]
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

        const result = await createDependencies(null, {
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

      it('should link a path dependency of a workspace member on a project outside the workspace', async () => {
        vol.fromJSON({
          'apps/app1/pyproject.toml': dedent`
          [project]
          name = "app1"
          version = "0.1.0"
          requires-python = ">=3.12"
          dependencies = [
              "dep1",
          ]

          [tool.uv.sources]
          dep1 = { path = "../../tools/dep1" }
          `,

          'tools/dep1/pyproject.toml': dedent`
          [project]
          name = "dep1"
          version = "0.1.0"
          requires-python = ">=3.12"
          dependencies = []
          `,

          'pyproject.toml': dedent`
          [tool.uv.workspace]
          members = ["apps/*"]
          `,

          'uv.lock': dedent`
          version = 1
          requires-python = ">=3.12"

          [[package]]
          name = "app1"
          version = "0.1.0"
          source = { editable = "apps/app1" }
          dependencies = [
              { name = "dep1" },
          ]

          [package.metadata]
          requires-dist = [
              { name = "dep1", directory = "tools/dep1" },
          ]

          [[package]]
          name = "dep1"
          version = "0.1.0"
          source = { directory = "tools/dep1" }
          `,
        });

        const projects = {
          app1: {
            root: 'apps/app1',
            targets: {},
          },
          dep1: {
            root: 'tools/dep1',
            targets: {},
          },
        };

        const result = await createDependencies(null, {
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

      it('should progress the dependency graph when the uv workspace root is in a subdirectory', async () => {
        vol.fromJSON({
          'python/apps/app1/pyproject.toml': dedent`
          [project]
          name = "app1"
          version = "0.1.0"
          readme = "README.md"
          requires-python = ">=3.12"
          dependencies = [
              "dep1",
          ]

          [tool.hatch.build.targets.wheel]
          packages = ["app1"]

          [tool.uv.sources]
          dep1 = { workspace = true }
          `,

          'python/libs/dep1/pyproject.toml': dedent`
          [project]
          name = "dep1"
          version = "0.1.0"
          readme = "README.md"
          requires-python = ">=3.12"
          dependencies = []
          `,

          'python/pyproject.toml': dedent`
          [tool.uv.workspace]
          members = ["apps/*", "libs/*"]
          `,

          'python/uv.lock': dedent`
          version = 1
          requires-python = ">=3.12"

          [[package]]
          name = "app1"
          version = "0.1.0"
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
          version = "0.1.0"
          source = { editable = "libs/dep1" }
          `,
        });

        const projects = {
          app1: {
            root: 'python/apps/app1',
            targets: {},
          },
          dep1: {
            root: 'python/libs/dep1',
            targets: {},
          },
        };

        const result = await createDependencies(
          { packageManager: 'uv' },
          {
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
          },
        );

        expect(result).toStrictEqual([
          {
            source: 'app1',
            target: 'dep1',
            type: 'implicit',
          },
        ]);
      });

      it('should link a path dependency on a member of another uv workspace', async () => {
        vol.fromJSON({
          'python/libs/dep1/pyproject.toml': dedent`
          [project]
          name = "dep1"
          version = "0.1.0"
          requires-python = ">=3.12"
          dependencies = []
          `,

          'python/pyproject.toml': dedent`
          [tool.uv.workspace]
          members = ["libs/*"]
          `,

          'python/uv.lock': dedent`
          version = 1
          requires-python = ">=3.12"

          [[package]]
          name = "dep1"
          version = "0.1.0"
          source = { editable = "libs/dep1" }
          `,

          'spark/jobs/job1/pyproject.toml': dedent`
          [project]
          name = "job1"
          version = "0.1.0"
          requires-python = ">=3.9"
          dependencies = [
              "dep1",
              "dep2",
          ]

          [tool.uv.sources]
          dep1 = { path = "../../../python/libs/dep1", editable = true }
          dep2 = { workspace = true }
          `,

          'spark/libs/dep2/pyproject.toml': dedent`
          [project]
          name = "dep2"
          version = "0.1.0"
          requires-python = ">=3.9"
          dependencies = []
          `,

          'spark/pyproject.toml': dedent`
          [tool.uv.workspace]
          members = ["jobs/*", "libs/*"]
          `,

          'spark/uv.lock': dedent`
          version = 1
          requires-python = ">=3.9"

          [[package]]
          name = "dep1"
          version = "0.1.0"
          source = { editable = "../python/libs/dep1" }

          [[package]]
          name = "dep2"
          version = "0.1.0"
          source = { editable = "libs/dep2" }

          [[package]]
          name = "job1"
          version = "0.1.0"
          source = { editable = "jobs/job1" }
          dependencies = [
              { name = "dep1" },
              { name = "dep2" },
          ]

          [package.metadata]
          requires-dist = [
              { name = "dep1", editable = "../python/libs/dep1" },
              { name = "dep2", editable = "libs/dep2" },
          ]
          `,
        });

        const projects = {
          dep1: {
            root: 'python/libs/dep1',
            targets: {},
          },
          dep2: {
            root: 'spark/libs/dep2',
            targets: {},
          },
          job1: {
            root: 'spark/jobs/job1',
            targets: {},
          },
        };

        const result = await createDependencies(
          { packageManager: 'uv' },
          {
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
          },
        );

        expect(result).toStrictEqual([
          {
            source: 'job1',
            target: 'dep1',
            type: 'implicit',
          },
          {
            source: 'job1',
            target: 'dep2',
            type: 'implicit',
          },
        ]);
      });

      it('should not read the lock of a uv workspace the project is not a member of', async () => {
        vol.fromJSON({
          'python/apps/app1/pyproject.toml': dedent`
          [project]
          name = "app1"
          version = "0.1.0"
          requires-python = ">=3.12"
          dependencies = [
              "dep1",
          ]

          [tool.uv.sources]
          dep1 = { path = "../../libs/dep1" }
          `,

          'python/libs/dep1/pyproject.toml': dedent`
          [project]
          name = "dep1"
          version = "0.1.0"
          requires-python = ">=3.12"
          dependencies = []
          `,

          'python/pyproject.toml': dedent`
          [tool.uv.workspace]
          members = ["libs/*"]
          exclude = ["libs/legacy"]
          `,

          'python/uv.lock': dedent`
          version = 1
          requires-python = ">=3.12"

          [[package]]
          name = "dep1"
          version = "0.1.0"
          source = { editable = "libs/dep1" }
          `,
        });

        const provider = await getProvider(
          '.',
          undefined,
          undefined,
          undefined,
          {
            packageManager: 'uv',
          },
        );

        expect(provider.getWorkspaceRoot('python/libs/dep1')).toBe('python');
        expect(provider.getWorkspaceRoot('python/libs/legacy')).toBeNull();
        expect(provider.getWorkspaceRoot('python/apps/app1')).toBeNull();
        expect(
          provider.getDependencies(
            'app1',
            {
              app1: { root: 'python/apps/app1', targets: {} },
              dep1: { root: 'python/libs/dep1', targets: {} },
            },
            '.',
          ),
        ).toStrictEqual([{ name: 'dep1', category: 'main', version: '0.1.0' }]);
      });

      it('should progress the dependency graph for an empty project', async () => {
        const result = await createDependencies(null, {
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
          [project]
          name = "app1"
          version = "0.1.0"
          readme = "README.md"
          requires-python = ">=3.12"
          dependencies = [
              "dep1",
          ]

          [tool.uv.sources]
          dep1 = { workspace = true }
          `,

          'apps/app2/pyproject.toml': dedent`
          [project]
          name = "app2"
          version = "0.1.0"
          readme = "README.md"
          requires-python = ">=3.12"
          dependencies = [
              "dep3",
          ]

          [tool.uv.sources]
          dep3 = { workspace = true }
          `,

          'libs/dep1/pyproject.toml': dedent`
          [project]
          name = "dep1"
          version = "0.1.0"
          readme = "README.md"
          requires-python = ">=3.12"
          dependencies = []
          `,
          'libs/dep2/pyproject.toml': dedent`
          [project]
          name = "dep2"
          version = "0.1.0"
          readme = "README.md"
          requires-python = ">=3.12"
          dependencies = []
          `,

          'pyproject.toml': '',

          'uv.lock': dedent`
          version = 1
          requires-python = ">=3.12"

          [[package]]
          name = "app1"
          version = "0.1.0"
          source = { editable = "apps/app1" }
          dependencies = [
              { name = "dep1" },
          ]

          [package.dev-dependencies]
          dev = [
              { name = "flake8" },
              { name = "ruff" },
          ]

          [package.metadata]
          requires-dist = [
              { name = "dep1", editable = "libs/dep1" },
          ]

          [package.metadata.requires-dev]
          dev = [
              { name = "flake8", specifier = ">=7.1.1" },
              { name = "ruff", specifier = ">=0.8.2" },
          ]
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

        const result = await createDependencies(null, {
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

      it('should detect dependencies when Nx project name differs from Python package name', async () => {
        vol.fromJSON({
          'apps/my-app/pyproject.toml': dedent`
          [project]
          name = "acme-my-app"
          version = "0.1.0"
          requires-python = ">=3.12"
          dependencies = [
              "acme-shared-lib",
          ]

          [tool.uv.sources]
          acme-shared-lib = { workspace = true }
          `,

          'libs/shared-lib/pyproject.toml': dedent`
          [project]
          name = "acme-shared-lib"
          version = "0.1.0"
          requires-python = ">=3.12"
          dependencies = []
          `,

          'pyproject.toml': dedent`
          [tool.uv.sources]
          acme-my-app = { workspace = true }
          acme-shared-lib = { workspace = true }
          `,

          'uv.lock': dedent`
          version = 1
          requires-python = ">=3.12"

          [[package]]
          name = "acme-my-app"
          version = "0.1.0"
          source = { editable = "apps/my-app" }
          dependencies = [
              { name = "acme-shared-lib" },
          ]

          [package.metadata]
          requires-dist = [
              { name = "acme-shared-lib", editable = "libs/shared-lib" },
          ]

          [[package]]
          name = "acme-shared-lib"
          version = "0.1.0"
          source = { editable = "libs/shared-lib" }
          `,
        });

        const projects = {
          'my-app': {
            root: 'apps/my-app',
            targets: {},
          },
          'shared-lib': {
            root: 'libs/shared-lib',
            targets: {},
          },
        };

        const result = await createDependencies(
          { packageManager: 'uv' },
          {
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
          },
        );

        expect(result).toStrictEqual([
          {
            source: 'my-app',
            target: 'shared-lib',
            type: 'implicit',
          },
        ]);
      });

      it('should progress the dependency graph when there is an app with an empty pyproject.toml', async () => {
        vol.fromJSON({
          'apps/app1/pyproject.toml': dedent`
          [project]
          name = "app1"
          version = "0.1.0"
          readme = "README.md"
          requires-python = ">=3.12"
          dependencies = [
              "dep1",
          ]

          [tool.uv.sources]
          dep1 = { workspace = true }
          `,
          'apps/app2/pyproject.toml': '',
          'libs/dep1/pyproject.toml': dedent`
          [project]
          name = "dep1"
          version = "0.1.0"
          readme = "README.md"
          requires-python = ">=3.12"
          dependencies = []
          `,
          'libs/dep2/pyproject.toml': dedent`
          [project]
          name = "dep2"
          version = "0.1.0"
          readme = "README.md"
          requires-python = ">=3.12"
          dependencies = []
          `,
          'pyproject.toml': '',
          'uv.lock': dedent`
          version = 1
          requires-python = ">=3.12"

          [[package]]
          name = "app1"
          version = "0.1.0"
          source = { editable = "apps/app1" }
          dependencies = [
              { name = "dep1" },
          ]

          [package.metadata]
          requires-dist = [
              { name = "dep1", editable = "libs/dep1" },
          ]
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

        const result = await createDependencies(null, {
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
      it('should return the dependent projects', async () => {
        vol.fromJSON({
          'apps/app1/pyproject.toml': dedent`
          [project]
          name = "app1"
          version = "0.1.0"
          readme = "README.md"
          requires-python = ">=3.12"
          dependencies = [
              "dep1",
          ]

          [tool.uv.sources]
          dep1 = { workspace = true }
          `,
          'libs/dep1/pyproject.toml': dedent`
          [project]
          name = "dep1"
          version = "0.1.0"
          readme = "README.md"
          requires-python = ">=3.12"
          dependencies = []
          `,

          'pyproject.toml': '',

          'uv.lock': dedent`
          version = 1
          requires-python = ">=3.12"

          [[package]]
          name = "app1"
          version = "0.1.0"
          source = { editable = "apps/app1" }
          dependencies = [
              { name = "dep1" },
          ]

          [package.metadata]
          requires-dist = [
              { name = "dep1", editable = "libs/dep1" },
          ]
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

        const provider = await getProvider('.');
        const result = provider.getDependents('dep1', projects, '.');

        expect(result).toStrictEqual(['app1']);
      });

      it('should return the dependent projects when the uv workspace root is in a subdirectory', async () => {
        vol.fromJSON({
          'python/apps/app1/pyproject.toml': dedent`
          [project]
          name = "app1"
          version = "0.1.0"
          requires-python = ">=3.12"
          dependencies = [
              "dep1",
          ]
          `,
          'python/libs/dep1/pyproject.toml': dedent`
          [project]
          name = "dep1"
          version = "0.1.0"
          requires-python = ">=3.12"
          dependencies = []
          `,

          'python/pyproject.toml': dedent`
          [tool.uv.workspace]
          members = ["apps/*", "libs/*"]

          [tool.uv.sources]
          dep1 = { workspace = true }
          `,

          'python/uv.lock': dedent`
          version = 1
          requires-python = ">=3.12"

          [[package]]
          name = "app1"
          version = "0.1.0"
          source = { editable = "apps/app1" }
          dependencies = [
              { name = "dep1" },
          ]

          [package.metadata]
          requires-dist = [
              { name = "dep1", editable = "libs/dep1" },
          ]
          `,
        });

        const projects = {
          app1: {
            root: 'python/apps/app1',
            targets: {},
          },
          dep1: {
            root: 'python/libs/dep1',
            targets: {},
          },
        };

        const provider = await getProvider(
          '.',
          undefined,
          undefined,
          undefined,
          {
            packageManager: 'uv',
          },
        );
        const result = provider.getDependents('dep1', projects, '.');

        expect(result).toStrictEqual(['app1']);
      });

      it('should return not throw an error when the pyproject is invalid or empty', async () => {
        vol.fromJSON({
          'apps/app1/pyproject.toml': '',
          'libs/dep1/pyproject.toml': dedent`
          [project]
          name = "dep1"
          version = "0.1.0"
          readme = "README.md"
          requires-python = ">=3.12"
          dependencies = []
          `,
          'pyproject.toml': '',
          'uv.lock': dedent`
          version = 1
          requires-python = ">=3.12"

          [[package]]
          name = "app1"
          version = "0.1.0"
          source = { editable = "apps/app1" }
          dependencies = [
              { name = "dep1" },
          ]
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

        const provider = await getProvider('.');
        const result = provider.getDependents('dep1', projects, '.');

        expect(result).toStrictEqual([]);
      });
    });

    describe('infer dependencies', () => {
      it('should scan the project for modules that import other local projects (hatch)', async () => {
        vol.fromJSON({
          'apps/app1/pyproject.toml': dedent`
          [project]
          name = "app1"
          version = "0.1.0"
          readme = "README.md"
          requires-python = ">=3.12"
          dependencies = [
              "dep3",
          ]

          [tool.hatch.build.targets.wheel]
          packages = ["app1"]

          [tool.uv.sources]
          dep3 = { workspace = true }

          [build-system]
          requires = ["hatchling"]
          build-backend = "hatchling.build"
          `,

          'apps/app1/app1/test1.py': dedent`
          import dep1
          `,
          'apps/app1/app1/test2.py': dedent`
          from dep2.test1 import test1
          `,
          'apps/app1/app1/test3.py': dedent`
          from dep3 import test2
          `,

          'libs/dep1/pyproject.toml': dedent`
          [project]
          name = "dep1"
          version = "0.1.0"
          readme = "README.md"
          requires-python = ">=3.12"
          dependencies = []

          [build-system]
          requires = ["hatchling"]
          build-backend = "hatchling.build"

          [tool.hatch.build.targets.wheel]
          packages = ["dep1"]
          `,
          'libs/dep2/pyproject.toml': dedent`
          [project]
          name = "dep2"
          version = "0.1.0"
          readme = "README.md"
          requires-python = ">=3.12"
          dependencies = []

          [build-system]
          requires = ["hatchling"]
          build-backend = "hatchling.build"

          [tool.hatch.build.targets.wheel]
          packages = ["dep2"]
          `,
          'libs/dep3/pyproject.toml': dedent`
          [project]
          name = "dep3"
          version = "0.1.0"
          readme = "README.md"
          requires-python = ">=3.12"
          dependencies = []

          [build-system]
          requires = ["hatchling"]
          build-backend = "hatchling.build"

          [tool.hatch.build.targets.wheel]
          packages = ["dep3"]
          `,

          'pyproject.toml': '',

          'uv.lock': dedent`
          version = 1
          requires-python = ">=3.12"

          [[package]]
          name = "app1"
          version = "0.1.0"
          source = { editable = "apps/app1" }
          dependencies = [
              { name = "dep3" },
          ]

          [package.metadata]
          requires-dist = [
              { name = "dep3", editable = "libs/dep3" },
          ]
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

        const result = await createDependencies(
          {
            inferDependencies: true,
            packageManager: 'uv',
          },
          {
            externalNodes: {},
            workspaceRoot: '.',
            projects,
            nxJsonConfiguration: {},
            fileMap: {
              nonProjectFiles: [],
              projectFileMap: {
                app1: [
                  { file: 'apps/app1/app1/test1.py', hash: 'a' },
                  { file: 'apps/app1/app1/test2.py', hash: 'b' },
                  { file: 'apps/app1/app1/test3.py', hash: 'c' },
                ],
              },
            },
            filesToProcess: {
              nonProjectFiles: [],
              projectFileMap: {
                app1: [
                  { file: 'apps/app1/app1/test1.py', hash: 'a' },
                  { file: 'apps/app1/app1/test2.py', hash: 'b' },
                  { file: 'apps/app1/app1/test3.py', hash: 'c' },
                ],
              },
            },
          },
        );

        expect(result).toStrictEqual([
          {
            source: 'app1',
            target: 'dep3',
            type: 'implicit',
          },
          {
            source: 'app1',
            target: 'dep1',
            type: 'dynamic',
            sourceFile: 'apps/app1/app1/test1.py',
          },
          {
            source: 'app1',
            target: 'dep2',
            type: 'dynamic',
            sourceFile: 'apps/app1/app1/test2.py',
          },
        ]);
      });

      it('should scan the project for modules that import other local projects (src)', async () => {
        vol.fromJSON({
          'apps/app1/pyproject.toml': dedent`
          [project]
          name = "app1"
          version = "0.1.0"
          readme = "README.md"
          requires-python = ">=3.12"
          dependencies = [
              "dep3",
          ]

          [tool.uv.sources]
          dep3 = { workspace = true }

          [build-system]
          requires = ["uv"]
          build-backend = "uv_build"
          `,

          'apps/app1/src/app1/test1.py': dedent`
          import dep1
          `,
          'apps/app1/src/app1/test2.py': dedent`
          from dep2.test1 import test1
          `,
          'apps/app1/src/app1/test3.py': dedent`
          from dep3 import test2
          `,

          'libs/dep1/pyproject.toml': dedent`
          [project]
          name = "dep1"
          version = "0.1.0"
          readme = "README.md"
          requires-python = ">=3.12"
          dependencies = []

          [build-system]
          requires = ["uv"]
          build-backend = "uv_build"
          `,

          'libs/dep1/src/dep1/__init__.py': '',

          'libs/dep2/pyproject.toml': dedent`
          [project]
          name = "dep2"
          version = "0.1.0"
          readme = "README.md"
          requires-python = ">=3.12"
          dependencies = []

          [build-system]
          requires = ["uv"]
          build-backend = "uv_build"
          `,

          'libs/dep2/src/dep2/__init__.py': '',

          'libs/dep3/pyproject.toml': dedent`
          [project]
          name = "dep3"
          version = "0.1.0"
          readme = "README.md"
          requires-python = ">=3.12"
          dependencies = []

          [build-system]
          requires = ["uv"]
          build-backend = "uv_build"
          `,

          'libs/dep3/src/dep3/__init__.py': '',

          'pyproject.toml': '',

          'uv.lock': dedent`
          version = 1
          requires-python = ">=3.12"

          [[package]]
          name = "app1"
          version = "0.1.0"
          source = { editable = "apps/app1" }
          dependencies = [
              { name = "dep3" },
          ]

          [package.metadata]
          requires-dist = [
              { name = "dep3", editable = "libs/dep3" },
          ]
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

        const result = await createDependencies(
          {
            inferDependencies: true,
            packageManager: 'uv',
          },
          {
            externalNodes: {},
            workspaceRoot: '.',
            projects,
            nxJsonConfiguration: {},
            fileMap: {
              nonProjectFiles: [],
              projectFileMap: {
                app1: [
                  { file: 'apps/app1/src/app1/test1.py', hash: 'a' },
                  { file: 'apps/app1/src/app1/test2.py', hash: 'b' },
                  { file: 'apps/app1/src/app1/test3.py', hash: 'c' },
                ],
              },
            },
            filesToProcess: {
              nonProjectFiles: [],
              projectFileMap: {
                app1: [
                  { file: 'apps/app1/src/app1/test1.py', hash: 'a' },
                  { file: 'apps/app1/src/app1/test2.py', hash: 'b' },
                  { file: 'apps/app1/src/app1/test3.py', hash: 'c' },
                ],
              },
            },
          },
        );

        expect(result).toStrictEqual([
          {
            source: 'app1',
            target: 'dep3',
            type: 'implicit',
          },
          {
            source: 'app1',
            target: 'dep1',
            type: 'dynamic',
            sourceFile: 'apps/app1/src/app1/test1.py',
          },
          {
            source: 'app1',
            target: 'dep2',
            type: 'dynamic',
            sourceFile: 'apps/app1/src/app1/test2.py',
          },
        ]);
      });

      it('should only scan the files in the Nx file map', async () => {
        vol.fromJSON({
          'apps/app1/pyproject.toml': dedent`
          [project]
          name = "app1"
          version = "0.1.0"
          requires-python = ">=3.12"
          dependencies = []

          [build-system]
          requires = ["uv"]
          build-backend = "uv_build"
          `,

          'apps/app1/src/app1/changed.py': dedent`
          import dep1
          `,
          'apps/app1/src/app1/unchanged.py': dedent`
          import dep2
          `,
          'apps/app1/src/app1/ignored_gen.py': dedent`
          import dep2
          `,

          'libs/dep1/pyproject.toml': dedent`
          [project]
          name = "dep1"
          version = "0.1.0"
          requires-python = ">=3.12"
          dependencies = []

          [build-system]
          requires = ["uv"]
          build-backend = "uv_build"
          `,

          'libs/dep1/src/dep1/__init__.py': '',

          'libs/dep2/pyproject.toml': dedent`
          [project]
          name = "dep2"
          version = "0.1.0"
          requires-python = ">=3.12"
          dependencies = []

          [build-system]
          requires = ["uv"]
          build-backend = "uv_build"
          `,

          'libs/dep2/src/dep2/__init__.py': '',

          'pyproject.toml': '',

          'uv.lock': dedent`
          version = 1
          requires-python = ">=3.12"

          [[package]]
          name = "app1"
          version = "0.1.0"
          source = { editable = "apps/app1" }
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
        };

        const changed = { file: 'apps/app1/src/app1/changed.py', hash: 'a' };
        const unchanged = {
          file: 'apps/app1/src/app1/unchanged.py',
          hash: 'b',
        };

        const result = await createDependencies(
          {
            inferDependencies: true,
            packageManager: 'uv',
          },
          {
            externalNodes: {},
            workspaceRoot: '.',
            projects,
            nxJsonConfiguration: {},
            fileMap: {
              nonProjectFiles: [],
              projectFileMap: { app1: [changed, unchanged] },
            },
            filesToProcess: {
              nonProjectFiles: [],
              projectFileMap: { app1: [changed] },
            },
          },
        );

        expect(result).toStrictEqual([
          {
            source: 'app1',
            target: 'dep1',
            type: 'dynamic',
            sourceFile: 'apps/app1/src/app1/changed.py',
          },
          {
            source: 'app1',
            target: 'dep2',
            type: 'dynamic',
            sourceFile: 'apps/app1/src/app1/unchanged.py',
          },
        ]);
      });
    });
  });

  describe('uv external nodes', () => {
    beforeEach(() => {
      vol.fromJSON({
        'apps/app1/pyproject.toml': dedent`
        [project]
        name = "app1"
        version = "0.1.0"
        dependencies = ["httpx"]
        `,
        'pyproject.toml': '',
        'uv.lock': dedent`
        version = 1
        requires-python = ">=3.12"

        [[package]]
        name = "app1"
        version = "0.1.0"
        source = { editable = "apps/app1" }
        dependencies = [
            { name = "httpx" },
        ]

        [[package]]
        name = "httpx"
        version = "0.27.0"
        source = { registry = "https://pypi.org/simple" }
        dependencies = [
            { name = "idna" },
        ]

        [[package]]
        name = "idna"
        version = "3.7"
        source = { registry = "https://pypi.org/simple" }
        `,
      });
    });

    const [pattern, createNodes] = createNodesV2;
    const nodesContext = { workspaceRoot: '.', nxJsonConfiguration: {} };
    const dependenciesContext = (
      externalNodes = {},
      fileMap = {
        nonProjectFiles: [{ file: 'uv.lock', hash: 'b' }],
        projectFileMap: {},
      },
    ) => ({
      externalNodes,
      workspaceRoot: '.',
      projects: { app1: { root: 'apps/app1', targets: {} } },
      nxJsonConfiguration: {},
      fileMap,
      filesToProcess: { nonProjectFiles: [], projectFileMap: {} },
    });

    it('should add the locked packages as external nodes when enabled', async () => {
      expect(pattern).toBe('**/{uv,poetry}.lock');

      const [[file, result]] = await createNodes(
        ['uv.lock'],
        { externalNodes: true },
        nodesContext,
      );

      expect(file).toBe('uv.lock');
      expect(Object.keys(result.externalNodes)).toStrictEqual([
        'pypi:httpx',
        'pypi:idna',
      ]);
    });

    it('should add no external nodes by default', async () => {
      expect(await createNodes(['uv.lock'], {}, nodesContext)).toStrictEqual(
        [],
      );
    });

    it('should make a member depend on every package it installs', async () => {
      const [[, { externalNodes }]] = await createNodes(
        ['uv.lock'],
        { externalNodes: true },
        nodesContext,
      );

      const result = await createDependencies(
        { externalNodes: true },
        dependenciesContext(externalNodes),
      );

      expect(result).toStrictEqual([
        { source: 'app1', target: 'pypi:httpx', type: 'implicit' },
        { source: 'app1', target: 'pypi:idna', type: 'implicit' },
      ]);
    });

    it('should keep the edges off the shared uv.lock, where Nx would cache or drop them', async () => {
      const [[, { externalNodes }]] = await createNodes(
        ['uv.lock'],
        { externalNodes: true },
        nodesContext,
      );
      const dependencies = await createDependencies(
        { externalNodes: true },
        dependenciesContext(externalNodes),
      );

      // Nx keeps a file's edges on its FileData and restores them from cache
      // for as long as that file's hash is unchanged.
      const pyproject = { file: 'apps/app1/pyproject.toml', hash: 'a' };
      const lockFile = { file: 'uv.lock', hash: 'b' };
      const builder = new ProjectGraphBuilder(
        undefined,
        { app1: [pyproject] },
        [lockFile],
      );
      builder.addNode({
        name: 'app1',
        type: 'lib',
        data: { root: 'apps/app1' },
      });
      for (const node of Object.values(externalNodes)) {
        builder.addExternalNode(node);
      }
      for (const dep of dependencies) {
        builder.addDependency(
          dep.source,
          dep.target,
          dep.type,
          'sourceFile' in dep ? dep.sourceFile : undefined,
        );
      }

      expect(pyproject).not.toHaveProperty('deps');
      expect(lockFile).not.toHaveProperty('deps');
      expect(
        builder.getUpdatedProjectGraph().dependencies['app1'],
      ).toStrictEqual([
        { source: 'app1', target: 'pypi:httpx', type: 'implicit' },
        { source: 'app1', target: 'pypi:idna', type: 'implicit' },
      ]);
    });

    it('should add implicit edges when another project owns uv.lock', async () => {
      const [[, { externalNodes }]] = await createNodes(
        ['uv.lock'],
        { externalNodes: true },
        nodesContext,
      );

      const result = await createDependencies(
        { externalNodes: true },
        dependenciesContext(externalNodes, {
          nonProjectFiles: [],
          projectFileMap: { root: [{ file: 'uv.lock', hash: 'b' }] },
        }),
      );

      expect(result).toStrictEqual([
        { source: 'app1', target: 'pypi:httpx', type: 'implicit' },
        { source: 'app1', target: 'pypi:idna', type: 'implicit' },
      ]);
    });
  });

  describe('uv external nodes shared by several members', () => {
    beforeEach(() => {
      vol.fromJSON({
        'apps/app1/pyproject.toml': '[project]\nname = "app1"\n',
        'apps/app2/pyproject.toml': '[project]\nname = "app2"\n',
        'pyproject.toml': '',
        'uv.lock': dedent`
        version = 1
        requires-python = ">=3.12"

        [[package]]
        name = "app1"
        version = "0.1.0"
        source = { editable = "apps/app1" }
        dependencies = [
            { name = "httpx" },
        ]

        [[package]]
        name = "app2"
        version = "0.1.0"
        source = { editable = "apps/app2" }
        dependencies = [
            { name = "httpx" },
        ]

        [[package]]
        name = "httpx"
        version = "0.27.0"
        source = { registry = "https://pypi.org/simple" }
        dependencies = [
            { name = "idna" },
        ]

        [[package]]
        name = "idna"
        version = "3.7"
        source = { registry = "https://pypi.org/simple" }
        `,
      });
    });

    it('should give every member its edges when they share the root lock file', async () => {
      const [, createNodes] = createNodesV2;
      const [[, { externalNodes }]] = await createNodes(
        ['uv.lock'],
        { externalNodes: true },
        { workspaceRoot: '.', nxJsonConfiguration: {} },
      );
      const projectFileMap = {
        app1: [{ file: 'apps/app1/pyproject.toml', hash: 'a' }],
        app2: [{ file: 'apps/app2/pyproject.toml', hash: 'b' }],
      };
      const nonProjectFiles = [{ file: 'uv.lock', hash: 'c' }];
      const dependencies = await createDependencies(
        { externalNodes: true },
        {
          externalNodes,
          workspaceRoot: '.',
          projects: {
            app1: { root: 'apps/app1', targets: {} },
            app2: { root: 'apps/app2', targets: {} },
          },
          nxJsonConfiguration: {},
          fileMap: { nonProjectFiles, projectFileMap },
          filesToProcess: { nonProjectFiles: [], projectFileMap: {} },
        },
      );

      // Nx drops an edge recorded on a workspace file when another project
      // already recorded one to the same target, so run them through it.
      const builder = new ProjectGraphBuilder(
        undefined,
        projectFileMap,
        nonProjectFiles,
      );
      for (const name of ['app1', 'app2']) {
        builder.addNode({ name, type: 'lib', data: { root: `apps/${name}` } });
      }
      for (const node of Object.values(externalNodes)) {
        builder.addExternalNode(node);
      }
      for (const dep of dependencies) {
        builder.addDependency(
          dep.source,
          dep.target,
          dep.type,
          'sourceFile' in dep ? dep.sourceFile : undefined,
        );
      }
      const graph = builder.getUpdatedProjectGraph();

      for (const name of ['app1', 'app2']) {
        expect(
          graph.dependencies[name].map(({ target }) => target),
        ).toStrictEqual(['pypi:httpx', 'pypi:idna']);
      }
    });
  });

  describe('uv external nodes in a subdirectory workspace', () => {
    it('should give every member of each uv workspace its edges', async () => {
      const lock = (member: string, dependency: string) => dedent`
        version = 1
        requires-python = ">=3.12"

        [[package]]
        name = "${member}"
        version = "0.1.0"
        source = { editable = "apps/${member}" }
        dependencies = [
            { name = "${dependency}" },
        ]

        [[package]]
        name = "${dependency}"
        version = "1.0.0"
        source = { registry = "https://pypi.org/simple" }
      `;
      const workspace = dedent`
        [tool.uv.workspace]
        members = ["apps/*"]
      `;
      vol.fromJSON({
        'python/pyproject.toml': workspace,
        'python/uv.lock': lock('app1', 'httpx'),
        'spark/pyproject.toml': workspace,
        'spark/uv.lock': lock('app2', 'six'),
      });

      const [, createNodes] = createNodesV2;
      const [[, { externalNodes }]] = await createNodes(
        ['python/uv.lock', 'spark/uv.lock'],
        { externalNodes: true, packageManager: 'uv' },
        { workspaceRoot: '.', nxJsonConfiguration: {} },
      );

      const result = await createDependencies(
        { externalNodes: true, packageManager: 'uv' },
        {
          externalNodes,
          workspaceRoot: '.',
          projects: {
            app1: { root: 'python/apps/app1', targets: {} },
            app2: { root: 'spark/apps/app2', targets: {} },
          },
          nxJsonConfiguration: {},
          fileMap: {
            nonProjectFiles: [
              { file: 'python/uv.lock', hash: 'a' },
              { file: 'spark/uv.lock', hash: 'b' },
            ],
            projectFileMap: {},
          },
          filesToProcess: { nonProjectFiles: [], projectFileMap: {} },
        },
      );

      expect(result).toStrictEqual([
        { source: 'app1', target: 'pypi:httpx', type: 'implicit' },
        { source: 'app2', target: 'pypi:six', type: 'implicit' },
      ]);
    });
  });

  describe('poetry external nodes', () => {
    beforeEach(() => {
      vol.fromJSON({
        'apps/app1/pyproject.toml': dedent`
        [tool.poetry]
        name = "app1"
        version = "0.1.0"

        [tool.poetry.dependencies]
        python = ">=3.9,<4"
        requests = "^2.31"
        `,
        'apps/app1/poetry.lock': dedent`
        [[package]]
        name = "idna"
        version = "3.20"
        optional = false
        python-versions = ">=3.9"
        groups = ["main"]
        files = [
            {file = "idna-3.20-py3-none-any.whl", hash = "sha256:aaa"},
        ]

        [[package]]
        name = "requests"
        version = "2.32.5"
        optional = false
        python-versions = ">=3.9"
        groups = ["main"]
        files = [
            {file = "requests-2.32.5-py3-none-any.whl", hash = "sha256:bbb"},
        ]

        [package.dependencies]
        idna = ">=2.5,<4"
        `,
      });
    });

    it("should key each project's edges to its own poetry.lock", async () => {
      const [, createNodes] = createNodesV2;
      const [[file, { externalNodes }]] = await createNodes(
        ['apps/app1/poetry.lock'],
        { externalNodes: true },
        { workspaceRoot: '.', nxJsonConfiguration: {} },
      );
      expect(file).toBe('apps/app1/poetry.lock');

      const result = await createDependencies(
        { externalNodes: true },
        {
          externalNodes,
          workspaceRoot: '.',
          projects: { app1: { root: 'apps/app1', targets: {} } },
          nxJsonConfiguration: {},
          fileMap: {
            nonProjectFiles: [],
            projectFileMap: {
              app1: [{ file: 'apps/app1/poetry.lock', hash: 'c' }],
            },
          },
          filesToProcess: { nonProjectFiles: [], projectFileMap: {} },
        },
      );

      expect(result).toStrictEqual([
        {
          source: 'app1',
          target: 'pypi:idna',
          type: 'static',
          sourceFile: 'apps/app1/poetry.lock',
        },
        {
          source: 'app1',
          target: 'pypi:requests',
          type: 'static',
          sourceFile: 'apps/app1/poetry.lock',
        },
      ]);
    });
  });
});
