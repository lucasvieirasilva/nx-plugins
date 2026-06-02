import { vi } from 'vitest';
import { ProjectGraph, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import dedent from 'string-dedent';
import PythonVersionActions from './version-actions';
import { UVProvider } from '../provider/uv/provider';
import { PoetryProvider } from '../provider/poetry/provider';
import { BaseProvider } from '../provider/base';
import { Logger } from '../executors/utils/logger';

const projectGraph = {
  nodes: {
    lib1: { data: { root: 'libs/lib1' } },
    lib2: { data: { root: 'libs/lib2' } },
  },
} as unknown as ProjectGraph;

describe('PythonVersionActions', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({});
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  function createActions(
    provider: BaseProvider<unknown>,
    bundleLocalDependencies: boolean | undefined,
  ): PythonVersionActions {
    const targets =
      bundleLocalDependencies === undefined
        ? {}
        : { build: { options: { bundleLocalDependencies } } };

    const actions = new PythonVersionActions(
      {} as never,
      {
        name: 'app1',
        type: 'lib',
        data: { root: 'apps/app1', targets },
      } as never,
      {} as never,
    );

    actions.manifestsToUpdate = [
      {
        manifestPath: 'apps/app1/pyproject.toml',
        preserveLocalDependencyProtocols: false,
      },
    ];

    (actions as unknown as { provider: BaseProvider<unknown> }).provider =
      provider;

    return actions;
  }

  describe('updateProjectDependencies', () => {
    describe('uv', () => {
      function setupWorkspace(app1Dependencies: string): void {
        tree.write(
          'libs/lib1/pyproject.toml',
          dedent`
            [project]
            name = "lib1"
            version = "1.4.0"
            dependencies = []
          `,
        );
        tree.write(
          'libs/lib2/pyproject.toml',
          dedent`
            [project]
            name = "lib2"
            version = "1.5.2"
            dependencies = []
          `,
        );
        tree.write(
          'apps/app1/pyproject.toml',
          dedent`
            [project]
            name = "app1"
            version = "1.3.0"
            dependencies = [ ${app1Dependencies} ]

            [tool.uv.sources.lib1]
            workspace = true
            [tool.uv.sources.lib2]
            workspace = true
          `,
        );
      }

      function readDependencies(): string[] {
        return new UVProvider('.', new Logger(), tree).getPyprojectToml(
          'apps/app1',
        ).project.dependencies;
      }

      function actions(
        bundleLocalDependencies: boolean | undefined,
      ): PythonVersionActions {
        return createActions(
          new UVProvider('.', new Logger(), tree),
          bundleLocalDependencies,
        );
      }

      it('returns an empty array when there are no dependencies to update', async () => {
        setupWorkspace('"lib1~=1.1"');

        const result = await actions(false).updateProjectDependencies(
          tree,
          projectGraph,
          {},
        );

        expect(result).toEqual([]);
        expect(readDependencies()).toEqual(['lib1~=1.1']);
      });

      it('is a no-op when bundleLocalDependencies defaults to true', async () => {
        setupWorkspace('"lib1~=1.1"');

        const result = await actions(undefined).updateProjectDependencies(
          tree,
          projectGraph,
          { lib1: '^1.4.0' },
        );

        expect(result).toEqual([]);
        expect(readDependencies()).toEqual(['lib1~=1.1']);
      });

      it('is a no-op when bundleLocalDependencies is explicitly true', async () => {
        setupWorkspace('"lib1~=1.1"');

        const result = await actions(true).updateProjectDependencies(
          tree,
          projectGraph,
          { lib1: '^1.4.0' },
        );

        expect(result).toEqual([]);
        expect(readDependencies()).toEqual(['lib1~=1.1']);
      });

      it('rewrites ranges and flags the project for lock refresh in publish mode', async () => {
        setupWorkspace('"lib1~=1.1", "lib2>=1.2,<2.0", "requests>=2.0"');

        const result = await actions(false).updateProjectDependencies(
          tree,
          projectGraph,
          { lib1: '^1.4.0', lib2: '^1.5.2' },
        );

        expect(readDependencies()).toEqual([
          'lib1~=1.4',
          'lib2>=1.5,<2.0',
          'requests>=2.0',
        ]);
        expect(result).toEqual([
          '✍️  Updated workspace dependency versions in manifest: apps/app1/pyproject.toml',
          '✍️  Flagged 2 workspace dependencies (lib1, lib2) for lock file refresh in manifest: apps/app1/pyproject.toml',
        ]);
      });

      it('uses the dependency version from its manifest, not the prefixed value from Nx', async () => {
        setupWorkspace('"lib1~=1.1"');

        await actions(false).updateProjectDependencies(tree, projectGraph, {
          lib1: '^9.9.9',
        });

        expect(readDependencies()).toEqual(['lib1~=1.4']);
      });
    });

    describe('poetry', () => {
      const app1Manifest = dedent`
        [tool.poetry]
        name = "app1"
        version = "1.3.0"

        [tool.poetry.dependencies]
        python = ">=3.9,<4"
        lib1 = { path = "../../libs/lib1", develop = true }
      `;

      function setupWorkspace(): void {
        tree.write(
          'libs/lib1/pyproject.toml',
          dedent`
            [tool.poetry]
            name = "lib1"
            version = "1.4.0"

            [tool.poetry.dependencies]
            python = ">=3.9,<4"
          `,
        );
        tree.write('apps/app1/pyproject.toml', app1Manifest);
      }

      function readManifest(): string {
        return tree.read('apps/app1/pyproject.toml', 'utf-8');
      }

      function actions(
        bundleLocalDependencies: boolean | undefined,
      ): PythonVersionActions {
        return createActions(
          new PoetryProvider('.', new Logger(), tree),
          bundleLocalDependencies,
        );
      }

      it('returns an empty array when there are no dependencies to update', async () => {
        setupWorkspace();

        const result = await actions(false).updateProjectDependencies(
          tree,
          projectGraph,
          {},
        );

        expect(result).toEqual([]);
        expect(readManifest()).toBe(app1Manifest);
      });

      it('is a no-op when bundleLocalDependencies is true', async () => {
        setupWorkspace();

        const result = await actions(true).updateProjectDependencies(
          tree,
          projectGraph,
          { lib1: '^1.4.0' },
        );

        expect(result).toEqual([]);
        expect(readManifest()).toBe(app1Manifest);
      });

      it('flags the project for lock refresh without rewriting the manifest in publish mode', async () => {
        setupWorkspace();

        const result = await actions(false).updateProjectDependencies(
          tree,
          projectGraph,
          { lib1: '^1.4.0' },
        );

        // Poetry references local dependencies via `path`/`develop`, so there is
        // no version specifier to rewrite; the project is still flagged so its
        // lock file is regenerated.
        expect(result).toEqual([
          '✍️  Flagged 1 workspace dependency (lib1) for lock file refresh in manifest: apps/app1/pyproject.toml',
        ]);
        expect(readManifest()).toBe(app1Manifest);
      });
    });
  });
});
