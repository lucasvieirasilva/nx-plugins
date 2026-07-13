import { ProjectConfiguration, ProjectGraph } from '@nx/devkit';
import {
  createTestWorkspace,
  PY_VERSION_ARGS,
  TestWorkspace,
  wheelFileList,
  wheelRequirement,
} from './utils/workspace';

// Exercises the uv provider end-to-end in both workspace layouts:
//  - individual project: each project owns its own virtual environment and
//    uv.lock (both build systems / layouts are covered here);
//  - shared venv (workspace): a uv workspace with a single root pyproject.toml /
//    uv.lock shared by all projects (via migrate-to-shared-venv).
describe('nx-python (uv)', () => {
  describe('individual project', () => {
    let ws: TestWorkspace;

    beforeAll(() => {
      // Pin the package manager to uv for the whole workspace so provider
      // detection is unambiguous.
      ws = createTestWorkspace('uv', { packageManager: 'uv' });
      // Packaged project: src layout + uv build backend.
      ws.generate(
        'uv-project',
        `app2 --projectType application --srcDir --buildSystem uv ${PY_VERSION_ARGS}`,
      );
      // Install so the project venv has its dev dependencies (pytest, ruff)
      // available for the test/lint targets.
      ws.nx('run app2:install');
    });

    afterAll(() => {
      ws?.cleanup();
    });

    it('scaffolds a packaged uv project (src layout, uv backend) with expected targets', () => {
      expect(ws.exists('app2/pyproject.toml')).toBe(true);
      expect(ws.exists('app2/src/app2/__init__.py')).toBe(true);
      expect(ws.readFile('app2/pyproject.toml')).toContain('uv_build');

      const project = ws.readJson<ProjectConfiguration>('app2/project.json');
      for (const target of ['build', 'lint', 'test', 'add', 'remove']) {
        expect(project.targets?.[target]).toBeDefined();
      }
    });

    it('builds the project into a wheel', () => {
      ws.nx('build app2');
      expect(ws.exists('app2/dist')).toBe(true);
      expect(ws.run('ls app2/dist')).toMatch(/\.whl/);
    });

    it('scaffolds and builds the flat layout with the hatchling build system', () => {
      ws.generate(
        'uv-project',
        `app3 --projectType application --buildSystem hatch ${PY_VERSION_ARGS}`,
      );
      // Flat layout: module lives at the project root, not under src/.
      expect(ws.exists('app3/app3/__init__.py')).toBe(true);
      expect(ws.exists('app3/src')).toBe(false);
      expect(ws.readFile('app3/pyproject.toml')).toContain('hatchling.build');

      ws.nx('build app3');
      expect(ws.run('ls app3/dist')).toMatch(/\.whl/);
    });

    it('lints the clean scaffold with ruff', () => {
      expect(() => ws.nx('lint app2')).not.toThrow();
    });

    it('runs unit tests (pytest) successfully', () => {
      expect(() => ws.nx('test app2')).not.toThrow();
    });

    it('adds and removes an external dependency', () => {
      ws.nx('run app2:add --name lorem');
      expect(ws.readFile('app2/pyproject.toml')).toContain('lorem');
      expect(ws.exists('app2/uv.lock')).toBe(true);
      expect(ws.readFile('app2/uv.lock')).toContain('lorem');

      ws.nx('run app2:remove --name lorem');
      expect(ws.readFile('app2/pyproject.toml')).not.toContain('lorem');
    });

    it('wires a local dependency and exposes the graph edge + pyproject entry', () => {
      ws.generate(
        'uv-project',
        `lib2 --projectType library --srcDir --buildSystem uv ${PY_VERSION_ARGS}`,
      );
      ws.nx('run app2:add --name lib2 --local');

      // pyproject references the local package via a uv source. In an
      // individual (non-workspace) project this is a path source.
      const pyproject = ws.readFile('app2/pyproject.toml');
      expect(pyproject).toContain('lib2');
      expect(pyproject).toContain('[tool.uv.sources]');
      expect(pyproject).toContain('path = "../lib2"');

      // Nx project graph has the app2 -> lib2 edge.
      ws.nx('graph --file=graph.json');
      const { graph } = ws.readJson<{ graph: ProjectGraph }>('graph.json');
      expect(graph.dependencies['app2'].map((d) => d.target)).toContain('lib2');

      // Give the local library an external dependency so the bundling behavior
      // below is observable in the wheel metadata. The library's own lockfile
      // should be updated too.
      ws.nx('run lib2:add --name six');
      expect(ws.readFile('lib2/pyproject.toml')).toContain('six');
      expect(ws.readFile('lib2/uv.lock')).toContain('six');
    });

    it('bundles the local dependency and honors locked vs unlocked versions', () => {
      // Default build (bundled + locked): the local source is packed into the
      // wheel and the local library's transitive dependency is pinned to the
      // locked version.
      ws.nx('build app2');
      const bundled = wheelFileList(ws, 'app2');
      expect(bundled).toContain('lib2/__init__.py');
      expect(bundled).toContain('lib2/hello.py');
      expect(wheelRequirement(ws, 'app2', 'six')).toContain('==');

      // Unlocked + unbundled: the local source is still packed, but the
      // transitive dependency is expressed as a range rather than a pinned
      // version. (lockedVersions:false is required alongside
      // bundleLocalDependencies:false — the locked+unbundled combo is rejected.)
      ws.nx(
        'build app2 --lockedVersions=false --bundleLocalDependencies=false',
      );
      expect(wheelFileList(ws, 'app2')).toContain('lib2/__init__.py');
      const sixConstraint = wheelRequirement(ws, 'app2', 'six');
      expect(sixConstraint).toContain('>=');
      expect(sixConstraint).not.toContain('==');
    });

    it('propagates a dependency added to a local library into the dependent lockfile', () => {
      // app2 depends on lib2, so adding a package to lib2 must update BOTH
      // per-project lockfiles: the library's own and its dependent's.
      ws.nx('run lib2:add --name lorem');
      expect(ws.readFile('lib2/uv.lock')).toContain('lorem');
      expect(ws.readFile('app2/uv.lock')).toContain('lorem');
    });
  });

  describe('shared venv (workspace)', () => {
    let ws: TestWorkspace;

    beforeAll(() => {
      ws = createTestWorkspace('uv-shared', { packageManager: 'uv' });
      ws.generate(
        'uv-project',
        `uvapp --projectType application --srcDir --buildSystem uv ${PY_VERSION_ARGS}`,
      );
      ws.generate(
        'uv-project',
        `uvlib --projectType library --srcDir --buildSystem uv ${PY_VERSION_ARGS}`,
      );
      // uvapp depends on uvlib so dependency propagation across the shared lock
      // can be exercised below.
      ws.nx('run uvapp:add --name uvlib --local');
      // Convert the workspace to a uv workspace: a root pyproject.toml with a
      // single shared uv.lock that owns every member and the dev dependencies.
      ws.generate(
        'migrate-to-shared-venv',
        '--packageManager=uv --moveDevDependencies=true',
      );
    });

    afterAll(() => {
      ws?.cleanup();
    });

    it('creates a uv workspace root referencing members and moving dev deps', () => {
      expect(ws.exists('pyproject.toml')).toBe(true);
      const root = ws.readFile('pyproject.toml');
      expect(root).toContain('[tool.uv.workspace]');
      expect(root).toContain('uvapp');
      expect(root).toContain('uvlib');
      // Dev dependencies were moved to the root dependency group.
      expect(root).toContain('[dependency-groups]');
      expect(root).toContain('ruff');
      // A uv workspace uses a single shared lock at the root, not per-project.
      expect(ws.exists('uv.lock')).toBe(true);
      expect(ws.exists('uvapp/uv.lock')).toBe(false);

      // In workspace mode the local dependency is linked as a workspace member
      // (`workspace = true`), not a path source.
      const member = ws.readFile('uvapp/pyproject.toml');
      expect(member).toContain('[tool.uv.sources.uvlib]');
      expect(member).toContain('workspace = true');
    });

    it('adds an external dependency and updates the shared lockfile', () => {
      ws.nx('run uvapp:add --name lorem');
      expect(ws.readFile('uvapp/pyproject.toml')).toContain('lorem');
      expect(ws.readFile('uv.lock')).toContain('lorem');
    });

    it('propagates a dependency added to a local library into the shared lockfile', () => {
      // uvapp depends on uvlib. Adding a package to uvlib updates the library's
      // manifest and the single shared root lock (uv workspaces have no
      // per-project locks).
      ws.nx('run uvlib:add --name six');
      expect(ws.readFile('uvlib/pyproject.toml')).toContain('six');
      expect(ws.readFile('uv.lock')).toContain('six');
    });

    it('builds a project in the shared workspace', () => {
      ws.nx('build uvapp');
      expect(ws.exists('uvapp/dist')).toBe(true);
      expect(ws.run('ls uvapp/dist')).toMatch(/\.whl/);
    });
  });
});
