import '../utils/mocks/fs.mock';
import { getProvider } from '../provider';
import { createDependencies } from './plugin';
import { vol } from 'memfs';

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
            target: 'dep3',
            type: 'implicit',
          },
          {
            source: 'app1',
            target: 'dep2',
            type: 'dynamic',
            sourceFile: 'apps/app1/app1/test2.py',
          },
          {
            source: 'app1',
            target: 'dep1',
            type: 'dynamic',
            sourceFile: 'apps/app1/app1/test1.py',
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
            target: 'dep3',
            type: 'implicit',
          },
          {
            source: 'app1',
            target: 'dep2',
            type: 'dynamic',
            sourceFile: 'apps/app1/app1/test2.py',
          },
          {
            source: 'app1',
            target: 'dep1',
            type: 'dynamic',
            sourceFile: 'apps/app1/app1/test1.py',
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
            target: 'dep3',
            type: 'implicit',
          },
          {
            source: 'app1',
            target: 'dep2',
            type: 'dynamic',
            sourceFile: 'apps/app1/src/app1/test2.py',
          },
          {
            source: 'app1',
            target: 'dep1',
            type: 'dynamic',
            sourceFile: 'apps/app1/src/app1/test1.py',
          },
        ]);
      });
    });
  });
});
