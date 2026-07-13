import { ProjectConfiguration, ProjectGraph } from '@nx/devkit';
import {
  createTestWorkspace,
  PY_VERSION_ARGS,
  TestWorkspace,
  wheelFileList,
  wheelRequirement,
} from './utils/workspace';

// Exercises the Poetry provider end-to-end in both workspace layouts:
//  - individual project: each project owns its own virtual environment;
//  - shared venv (workspace): a single root pyproject.toml / venv shared by all
//    projects (via migrate-to-shared-venv).
describe('nx-python (poetry)', () => {
  describe('individual project', () => {
    let ws: TestWorkspace;

    beforeAll(() => {
      ws = createTestWorkspace('poetry');
      // Application (flake8 is the Poetry default linter) + a library to depend on.
      ws.generate(
        'poetry-project',
        `app1 --projectType application ${PY_VERSION_ARGS}`,
      );
      ws.generate(
        'poetry-project',
        `lib1 --projectType library ${PY_VERSION_ARGS}`,
      );
      // Install so the project venv has its dev dependencies (pytest, flake8)
      // available for the test/lint targets.
      ws.nx('run app1:install');
    });

    afterAll(() => {
      ws?.cleanup();
    });

    it('scaffolds a Poetry project with the expected files and targets', () => {
      expect(ws.exists('app1/pyproject.toml')).toBe(true);
      expect(ws.exists('app1/app1/__init__.py')).toBe(true);
      expect(ws.readFile('app1/pyproject.toml')).toContain('[tool.poetry]');

      const project = ws.readJson<ProjectConfiguration>('app1/project.json');
      for (const target of [
        'build',
        'lint',
        'test',
        'add',
        'remove',
        'install',
      ]) {
        expect(project.targets?.[target]).toBeDefined();
      }
    });

    it('builds the project into a wheel + sdist', () => {
      ws.nx('build app1');
      expect(ws.exists('app1/dist')).toBe(true);
      const artifacts = ws.run('ls app1/dist');
      expect(artifacts).toMatch(/\.whl/);
      expect(artifacts).toMatch(/\.tar\.gz/);
    });

    it('runs unit tests (pytest) successfully', () => {
      expect(() => ws.nx('test app1')).not.toThrow();
    });

    it('lints the clean scaffold with flake8', () => {
      expect(() => ws.nx('lint app1')).not.toThrow();
    });

    it('adds and removes an external dependency', () => {
      ws.nx('run app1:add --name lorem');
      expect(ws.readFile('app1/pyproject.toml')).toContain('lorem');
      expect(ws.readFile('app1/poetry.lock')).toContain('lorem');

      ws.nx('run app1:remove --name lorem');
      expect(ws.readFile('app1/pyproject.toml')).not.toContain('lorem');
    });

    it('wires a local dependency and exposes the graph edge + pyproject entry', () => {
      ws.nx('run app1:add --name lib1 --local');

      // pyproject references the local package as a path dependency.
      const pyproject = ws.readFile('app1/pyproject.toml');
      expect(pyproject).toContain('[tool.poetry.dependencies.lib1]');
      expect(pyproject).toContain('path = "../lib1"');

      // Nx project graph has the app1 -> lib1 edge.
      ws.nx('graph --file=graph.json');
      const { graph } = ws.readJson<{ graph: ProjectGraph }>('graph.json');
      const deps = graph.dependencies['app1'].map((d) => d.target);
      expect(deps).toContain('lib1');

      // Give the local library an external dependency so the bundling behavior
      // below is observable in the wheel metadata. The library's own lockfile
      // should be updated too.
      ws.nx('run lib1:add --name six');
      expect(ws.readFile('lib1/pyproject.toml')).toContain('six');
      expect(ws.readFile('lib1/poetry.lock')).toContain('six');
    });

    it('bundles the local dependency and honors locked vs unlocked versions', () => {
      // Default build (bundled + locked): the local source is packed into the
      // wheel and the local library's transitive dependency is pinned to the
      // locked version.
      ws.nx('build app1');
      const bundled = wheelFileList(ws, 'app1');
      expect(bundled).toContain('lib1/__init__.py');
      expect(bundled).toContain('lib1/hello.py');
      expect(wheelRequirement(ws, 'app1', 'six')).toContain('==');

      // Unlocked + unbundled: the local source is still packed, but the
      // transitive dependency is expressed as a range rather than a pinned
      // version. (lockedVersions:false is required alongside
      // bundleLocalDependencies:false — the locked+unbundled combo is rejected.)
      ws.nx(
        'build app1 --lockedVersions=false --bundleLocalDependencies=false',
      );
      expect(wheelFileList(ws, 'app1')).toContain('lib1/__init__.py');
      const sixConstraint = wheelRequirement(ws, 'app1', 'six');
      expect(sixConstraint).toContain('>=');
      expect(sixConstraint).not.toContain('==');
    });

    it('propagates a dependency added to a local library into the dependent lockfile', () => {
      // app1 depends on lib1, so adding a package to lib1 must update BOTH
      // lockfiles: the library's own and its dependent's.
      ws.nx('run lib1:add --name lorem');
      expect(ws.readFile('lib1/poetry.lock')).toContain('lorem');
      expect(ws.readFile('app1/poetry.lock')).toContain('lorem');
    });

    it('runs an arbitrary command inside the project venv (run-commands)', () => {
      const project = ws.readJson<ProjectConfiguration>('lib1/project.json');
      project.targets = {
        ...project.targets,
        'py-version': {
          executor: '@nxlv/python:run-commands',
          options: {
            commands: [{ command: 'python --version' }],
          },
        },
      };
      ws.writeJson('lib1/project.json', project);

      const output = ws.nx('run lib1:py-version');
      expect(output).toMatch(/Python 3\./);
    });
  });

  describe('shared venv (workspace)', () => {
    let ws: TestWorkspace;

    beforeAll(() => {
      ws = createTestWorkspace('poetry-shared');
      ws.generate(
        'poetry-project',
        `svapp --projectType application ${PY_VERSION_ARGS}`,
      );
      ws.generate(
        'poetry-project',
        `svlib --projectType library ${PY_VERSION_ARGS}`,
      );
      // svapp depends on svlib so dependency propagation across the shared
      // lockfiles can be exercised below.
      ws.nx('run svapp:add --name svlib --local');
      // Convert the workspace to a single shared virtual environment: a root
      // pyproject.toml/poetry.lock that references every project and owns the
      // dev dependencies.
      ws.generate(
        'migrate-to-shared-venv',
        '--packageManager=poetry --moveDevDependencies=true',
      );
    });

    afterAll(() => {
      ws?.cleanup();
    });

    it('creates a root pyproject referencing the project and moving dev deps', () => {
      expect(ws.exists('pyproject.toml')).toBe(true);
      const root = ws.readFile('pyproject.toml');
      // References the local project and enables auto-activation of the venv.
      expect(root).toContain('svapp');
      expect(root).toContain('autoActivate');
      // Dev dependencies were moved to the root.
      expect(root).toContain('[tool.poetry.group.dev.dependencies]');
      expect(root).toContain('pytest');

      // Unlike uv workspaces, Poetry links local dependencies by path even in
      // the shared-venv layout.
      expect(ws.readFile('svapp/pyproject.toml')).toContain(
        'path = "../svlib"',
      );
    });

    it('adds an external dependency and updates the shared lockfile', () => {
      ws.nx('run svapp:add --name lorem');
      expect(ws.readFile('svapp/pyproject.toml')).toContain('lorem');
      expect(ws.readFile('poetry.lock')).toContain('lorem');
    });

    it('propagates a dependency added to a local library into every lockfile', () => {
      // svapp depends on svlib. Adding a package to svlib must update all three
      // lockfiles in the shared workspace: the root, the dependent (svapp), and
      // the library (svlib) itself.
      ws.nx('run svlib:add --name six');
      expect(ws.readFile('svlib/poetry.lock')).toContain('six');
      expect(ws.readFile('svapp/poetry.lock')).toContain('six');
      expect(ws.readFile('poetry.lock')).toContain('six');
    });

    it('builds a project in the shared virtual environment', () => {
      ws.nx('build svapp');
      expect(ws.exists('svapp/dist')).toBe(true);
      expect(ws.run('ls svapp/dist')).toMatch(/\.whl/);
    });
  });
});
