import { ProjectConfiguration } from '@nx/devkit';
import type { PoetryPyprojectToml, UVPyprojectToml } from '@nxlv/python';
import {
  createTestWorkspace,
  PY_VERSION_ARGS,
  registerGlobalSyncGenerator,
  runSyncCheck,
  TestWorkspace,
} from './utils/workspace';

// Exercises the `@nxlv/python:pkg-sync` sync generator end-to-end for both
// providers and both workspace layouts.
//
// pkg-sync reconciles the Nx project graph with the Python manifests: every
// graph dependency of a project must appear as a local dependency in that
// project's pyproject.toml, and in a shared-venv workspace every project must
// also be registered in the root pyproject.toml. `nx sync:check` reports the
// drift without writing; `nx sync` writes it and re-locks the affected projects.
//
// The graph edges here come from `implicitDependencies` in project.json rather
// than from import scanning, so these tests exercise pkg-sync itself instead of
// the dependency-inference plugin (which infer-deps.spec covers).
//
// Manifest keys are asserted through a real TOML parse rather than substring
// matching, because the central concern is WHICH key a dependency is written
// under: it must be the package name from the manifest, which is independent of
// the Nx project name.

/**
 * Adds a graph edge from `project` to `dependency` via `implicitDependencies`,
 * which Nx resolves natively. The dependency is deliberately NOT added to the
 * manifest: that gap is what pkg-sync has to close.
 */
function addImplicitDependency(
  ws: TestWorkspace,
  project: string,
  dependency: string,
) {
  const path = `${project}/project.json`;
  const config = ws.readJson<ProjectConfiguration>(path);
  config.implicitDependencies = [
    ...(config.implicitDependencies ?? []),
    dependency,
  ];
  ws.writeJson(path, config);
}

/** Dependency names declared in a uv manifest, stripped of any specifier. */
function uvDependencyNames(dependencies: string[]): string[] {
  return dependencies.map((dep) => /^[a-zA-Z0-9-_]+/.exec(dep)?.[0] ?? dep);
}

describe('nx-python (pkg-sync)', () => {
  describe('poetry (individual projects)', () => {
    let ws: TestWorkspace;

    beforeAll(() => {
      ws = createTestWorkspace('pkg-sync-poetry');
      registerGlobalSyncGenerator(ws);

      ws.generate(
        'poetry-project',
        `app1 --projectType application ${PY_VERSION_ARGS}`,
      );
      ws.generate(
        'poetry-project',
        `lib1 --projectType library ${PY_VERSION_ARGS}`,
      );
      ws.generate(
        'poetry-project',
        `lib2 --projectType library ${PY_VERSION_ARGS}`,
      );
      // Package name deliberately different from the Nx project name.
      ws.generate(
        'poetry-project',
        `runner --projectType library --packageName my-org-task-runner --moduleName runner ${PY_VERSION_ARGS}`,
      );

      addImplicitDependency(ws, 'app1', 'lib1');
    });

    afterAll(() => {
      ws?.cleanup();
    });

    it('reports the missing local dependency without writing it', () => {
      const before = ws.readFile('app1/pyproject.toml');

      const { inSync, output } = runSyncCheck(ws);

      expect(inSync).toBe(false);
      expect(output).toContain(
        'Project app1 is out of sync. Missing dependencies: lib1',
      );
      // sync:check reports only: the manifest must be untouched.
      expect(ws.readFile('app1/pyproject.toml')).toBe(before);
    });

    it('writes the missing local dependency as a develop path reference', () => {
      ws.nx('sync');

      const manifest = ws.readToml<PoetryPyprojectToml>('app1/pyproject.toml');
      expect(manifest.tool.poetry.dependencies['lib1']).toEqual({
        path: '../lib1',
        develop: true,
      });
      // Re-locked by the sync callbacks, so the environment matches.
      expect(ws.readFile('app1/poetry.lock')).toContain('lib1');
    });

    it('leaves the workspace in sync and re-runs as a no-op', () => {
      expect(runSyncCheck(ws).inSync).toBe(true);

      const before = ws.readFile('app1/pyproject.toml');
      ws.nx('sync');
      expect(ws.readFile('app1/pyproject.toml')).toBe(before);
    });

    it('syncs a dependency of a dependency into the intermediate project', () => {
      addImplicitDependency(ws, 'lib1', 'lib2');

      const { inSync, output } = runSyncCheck(ws);
      expect(inSync).toBe(false);
      expect(output).toContain(
        'Project lib1 is out of sync. Missing dependencies: lib2',
      );

      ws.nx('sync');

      const manifest = ws.readToml<PoetryPyprojectToml>('lib1/pyproject.toml');
      expect(manifest.tool.poetry.dependencies['lib2']).toEqual({
        path: '../lib2',
        develop: true,
      });
      expect(ws.readFile('lib1/poetry.lock')).toContain('lib2');
      // app1 depends on lib1, so syncing lib1 must re-lock its dependents too:
      // the new transitive dependency has to reach app1's environment.
      expect(ws.readFile('app1/poetry.lock')).toContain('lib2');
    });

    it('keys the dependency by the package name when it differs from the project name', () => {
      addImplicitDependency(ws, 'app1', 'runner');

      ws.nx('sync');

      const deps = ws.readToml<PoetryPyprojectToml>('app1/pyproject.toml').tool
        .poetry.dependencies;
      // Poetry requires a path dependency's key to be the package's own name.
      expect(deps['my-org-task-runner']).toEqual({
        path: '../runner',
        develop: true,
      });
      expect(deps['runner']).toBeUndefined();
      expect(ws.readFile('app1/poetry.lock')).toContain('my-org-task-runner');
      expect(runSyncCheck(ws).inSync).toBe(true);
    });
  });

  describe('poetry (shared venv workspace)', () => {
    let ws: TestWorkspace;

    beforeAll(() => {
      ws = createTestWorkspace('pkg-sync-poetry-shared');
      registerGlobalSyncGenerator(ws);

      ws.generate(
        'poetry-project',
        `svapp --projectType application ${PY_VERSION_ARGS}`,
      );
      // Package name deliberately different from the Nx project name.
      ws.generate(
        'poetry-project',
        `svlib --projectType library --packageName my-org-svlib --moduleName svlib ${PY_VERSION_ARGS}`,
      );
      ws.nx('run svapp:add --name svlib --local');
      // Root pyproject.toml + a single shared venv, with every project
      // registered in the root by its package name.
      ws.generate(
        'migrate-to-shared-venv',
        `--packageManager=poetry --moveDevDependencies=true ${PY_VERSION_ARGS}`,
      );
    });

    afterAll(() => {
      ws?.cleanup();
    });

    it('reports nothing and leaves the root manifest untouched when in sync', () => {
      const before = ws.readFile('pyproject.toml');

      expect(runSyncCheck(ws).inSync).toBe(true);

      ws.nx('sync');
      // A no-op sync must not reformat the root manifest: any rewrite would
      // itself make the workspace report as out of sync on the next check.
      expect(ws.readFile('pyproject.toml')).toBe(before);
    });

    it('restores a root entry removed by hand, keyed by the package name', () => {
      const root = ws.readToml<PoetryPyprojectToml>('pyproject.toml');
      delete root.tool.poetry.dependencies['my-org-svlib'];
      ws.writeToml('pyproject.toml', root);

      const { inSync, output } = runSyncCheck(ws);
      expect(inSync).toBe(false);
      expect(output).toContain(
        'Root pyproject.toml is out of sync. Missing dependency: my-org-svlib',
      );

      ws.nx('sync');

      const deps =
        ws.readToml<PoetryPyprojectToml>('pyproject.toml').tool.poetry
          .dependencies;
      expect(deps['my-org-svlib']).toEqual({ path: 'svlib', develop: true });
      // No second entry under the Nx project name.
      expect(deps['svlib']).toBeUndefined();
    });

    it('honors a project registered in a non-main dependency group', () => {
      ws.generate(
        'poetry-project',
        `svtool --projectType library --packageName my-org-svtool --moduleName svtool --rootPyprojectDependencyGroup dev ${PY_VERSION_ARGS}`,
      );

      const root = ws.readToml<PoetryPyprojectToml>('pyproject.toml');
      expect(
        root.tool.poetry.group?.['dev'].dependencies['my-org-svtool'],
      ).toBeDefined();
      expect(root.tool.poetry.dependencies['my-org-svtool']).toBeUndefined();

      // The entry lives in the dev group, so the root is NOT out of sync.
      expect(runSyncCheck(ws).inSync).toBe(true);

      ws.nx('sync');

      // And sync must not duplicate it into the main dependencies.
      const after = ws.readToml<PoetryPyprojectToml>('pyproject.toml');
      expect(after.tool.poetry.dependencies['my-org-svtool']).toBeUndefined();
    });

    it('writes a missing local dependency into a member manifest', () => {
      addImplicitDependency(ws, 'svapp', 'svtool');

      ws.nx('sync');

      const deps = ws.readToml<PoetryPyprojectToml>('svapp/pyproject.toml').tool
        .poetry.dependencies;
      expect(deps['my-org-svtool']).toEqual({
        path: '../svtool',
        develop: true,
      });
      // The shared workspace re-locks the member and the root together.
      expect(ws.readFile('svapp/poetry.lock')).toContain('my-org-svtool');
      expect(ws.readFile('poetry.lock')).toContain('my-org-svtool');
      expect(runSyncCheck(ws).inSync).toBe(true);
    });

    it('builds a synced project in the shared virtual environment', () => {
      ws.nx('build svapp');
      expect(ws.run('ls svapp/dist')).toMatch(/\.whl/);
    });
  });

  describe('uv (individual projects)', () => {
    let ws: TestWorkspace;

    beforeAll(() => {
      ws = createTestWorkspace('pkg-sync-uv', { packageManager: 'uv' });
      registerGlobalSyncGenerator(ws);

      // Flat layout + hatchling: the template pins the wheel's package folder to
      // the module name, so a package name that differs from the module still
      // builds.
      ws.generate(
        'uv-project',
        `uvapp --projectType application --buildSystem hatch ${PY_VERSION_ARGS}`,
      );
      ws.generate(
        'uv-project',
        `uvlib --projectType library --buildSystem hatch ${PY_VERSION_ARGS}`,
      );
      // Package name deliberately different from the Nx project name.
      ws.generate(
        'uv-project',
        `uvrunner --projectType library --buildSystem hatch --packageName my-org-uv-runner --moduleName uvrunner ${PY_VERSION_ARGS}`,
      );

      addImplicitDependency(ws, 'uvapp', 'uvlib');
    });

    afterAll(() => {
      ws?.cleanup();
    });

    it('reports the missing local dependency without writing it', () => {
      const before = ws.readFile('uvapp/pyproject.toml');

      const { inSync, output } = runSyncCheck(ws);

      expect(inSync).toBe(false);
      expect(output).toContain(
        'Project uvapp is out of sync. Missing dependencies: uvlib',
      );
      expect(ws.readFile('uvapp/pyproject.toml')).toBe(before);
    });

    it('writes the missing local dependency as a path source', () => {
      ws.nx('sync');

      const manifest = ws.readToml<UVPyprojectToml>('uvapp/pyproject.toml');
      expect(uvDependencyNames(manifest.project.dependencies)).toContain(
        'uvlib',
      );
      expect(manifest.tool.uv.sources?.['uvlib']).toEqual({ path: '../uvlib' });
      // Individual uv projects keep their own lock, re-generated by the sync
      // callbacks so the environment matches the manifest.
      expect(ws.readFile('uvapp/uv.lock')).toContain('uvlib');
    });

    it('leaves the workspace in sync and re-runs as a no-op', () => {
      expect(runSyncCheck(ws).inSync).toBe(true);

      const before = ws.readFile('uvapp/pyproject.toml');
      ws.nx('sync');
      expect(ws.readFile('uvapp/pyproject.toml')).toBe(before);
    });

    it('keys the dependency by the package name when it differs from the project name', () => {
      addImplicitDependency(ws, 'uvapp', 'uvrunner');

      ws.nx('sync');

      const manifest = ws.readToml<UVPyprojectToml>('uvapp/pyproject.toml');
      const names = uvDependencyNames(manifest.project.dependencies);
      // uv resolves a source by the distribution name, not the Nx project name.
      expect(names).toContain('my-org-uv-runner');
      expect(names).not.toContain('uvrunner');
      expect(manifest.tool.uv.sources?.['my-org-uv-runner']).toEqual({
        path: '../uvrunner',
      });
      expect(manifest.tool.uv.sources?.['uvrunner']).toBeUndefined();
      expect(ws.readFile('uvapp/uv.lock')).toContain('my-org-uv-runner');
      expect(runSyncCheck(ws).inSync).toBe(true);
    });
  });

  describe('uv (shared venv workspace)', () => {
    let ws: TestWorkspace;

    beforeAll(() => {
      ws = createTestWorkspace('pkg-sync-uv-shared', { packageManager: 'uv' });
      registerGlobalSyncGenerator(ws);

      ws.generate(
        'uv-project',
        `uvsapp --projectType application --buildSystem hatch ${PY_VERSION_ARGS}`,
      );
      // Package name deliberately different from the Nx project name.
      ws.generate(
        'uv-project',
        `uvslib --projectType library --buildSystem hatch --packageName my-org-uvslib --moduleName uvslib ${PY_VERSION_ARGS}`,
      );
      ws.nx('run uvsapp:add --name uvslib --local');
      // Root pyproject.toml + a single shared uv.lock, with every project
      // registered in the root by its package name.
      ws.generate(
        'migrate-to-shared-venv',
        `--packageManager=uv --moveDevDependencies=true ${PY_VERSION_ARGS}`,
      );
    });

    afterAll(() => {
      ws?.cleanup();
    });

    it('reports nothing and leaves the root manifest untouched when in sync', () => {
      const before = ws.readFile('pyproject.toml');

      expect(runSyncCheck(ws).inSync).toBe(true);

      ws.nx('sync');
      // A no-op sync must not reformat the root manifest: any rewrite would
      // itself make the workspace report as out of sync on the next check.
      expect(ws.readFile('pyproject.toml')).toBe(before);
    });

    it('restores a root dependency, source and member removed by hand', () => {
      const root = ws.readToml<UVPyprojectToml>('pyproject.toml');
      root.project.dependencies = root.project.dependencies.filter(
        (dep) => !dep.startsWith('my-org-uvslib'),
      );
      delete root.tool.uv.sources?.['my-org-uvslib'];
      root.tool.uv.workspace.members = root.tool.uv.workspace.members.filter(
        (member) => member !== 'uvslib',
      );
      ws.writeToml('pyproject.toml', root);

      const { inSync, output } = runSyncCheck(ws);
      expect(inSync).toBe(false);
      expect(output).toContain(
        'Root pyproject.toml is out of sync. Missing dependency: my-org-uvslib',
      );
      expect(output).toContain(
        'Root pyproject.toml is out of sync. Missing source: my-org-uvslib',
      );
      expect(output).toContain(
        'Root pyproject.toml is out of sync. Missing workspace member: uvslib',
      );

      ws.nx('sync');

      const after = ws.readToml<UVPyprojectToml>('pyproject.toml');
      const names = uvDependencyNames(after.project.dependencies);
      expect(names).toContain('my-org-uvslib');
      // No second entry under the Nx project name.
      expect(names).not.toContain('uvslib');
      expect(after.tool.uv.sources?.['my-org-uvslib']).toEqual({
        workspace: true,
      });
      expect(after.tool.uv.sources?.['uvslib']).toBeUndefined();
      expect(after.tool.uv.workspace.members).toContain('uvslib');
    });

    it('honors a project registered in a non-main dependency group', () => {
      ws.generate(
        'uv-project',
        `uvstool --projectType library --buildSystem hatch --packageName my-org-uvstool --moduleName uvstool --rootPyprojectDependencyGroup dev ${PY_VERSION_ARGS}`,
      );

      const root = ws.readToml<UVPyprojectToml>('pyproject.toml');
      expect(root['dependency-groups']?.['dev']).toContain('my-org-uvstool');
      expect(uvDependencyNames(root.project.dependencies)).not.toContain(
        'my-org-uvstool',
      );

      // The entry lives in the dev group, so the root is NOT out of sync.
      expect(runSyncCheck(ws).inSync).toBe(true);

      ws.nx('sync');

      // And sync must not duplicate it into the main dependencies.
      const after = ws.readToml<UVPyprojectToml>('pyproject.toml');
      expect(uvDependencyNames(after.project.dependencies)).not.toContain(
        'my-org-uvstool',
      );
    });

    it('writes a missing local dependency into a member manifest', () => {
      addImplicitDependency(ws, 'uvsapp', 'uvstool');

      ws.nx('sync');

      const manifest = ws.readToml<UVPyprojectToml>('uvsapp/pyproject.toml');
      expect(uvDependencyNames(manifest.project.dependencies)).toContain(
        'my-org-uvstool',
      );
      // Workspace members are linked as members, not paths.
      expect(manifest.tool.uv.sources?.['my-org-uvstool']).toEqual({
        workspace: true,
      });
      // A uv workspace has a single shared lock at the root.
      expect(ws.readFile('uv.lock')).toContain('my-org-uvstool');
      expect(ws.exists('uvsapp/uv.lock')).toBe(false);
      expect(runSyncCheck(ws).inSync).toBe(true);
    });

    it('builds a synced project in the shared workspace', () => {
      ws.nx('build uvsapp');
      expect(ws.run('ls uvsapp/dist')).toMatch(/\.whl/);
    });
  });

  describe('generator wiring (useSyncGenerators)', () => {
    let ws: TestWorkspace;

    afterAll(() => {
      ws?.cleanup();
    });

    it('registers pkg-sync on the build target and enables dependency inference', () => {
      ws = createTestWorkspace('pkg-sync-wiring');
      ws.generate(
        'poetry-project',
        `wired --projectType application --useSyncGenerators ${PY_VERSION_ARGS}`,
      );

      const project = ws.readJson<ProjectConfiguration>('wired/project.json');
      expect(project.targets?.['build'].syncGenerators).toEqual([
        '@nxlv/python:pkg-sync',
      ]);

      // pkg-sync is only useful when the graph knows about local imports, so
      // the generator turns dependency inference on as well.
      const nxJson = ws.readJson<{
        plugins: Array<string | { plugin: string; options?: unknown }>;
      }>('nx.json');
      const plugin = nxJson.plugins.find(
        (entry) => typeof entry === 'object' && entry.plugin === '@nxlv/python',
      ) as { options?: { inferDependencies?: boolean } };
      expect(plugin.options?.inferDependencies).toBe(true);
    });
  });
});
