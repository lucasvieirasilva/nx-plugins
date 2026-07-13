import { NxJsonConfiguration, ProjectGraph } from '@nx/devkit';
import {
  createTestWorkspace,
  PY_VERSION_ARGS,
  TestWorkspace,
} from './utils/workspace';

// Exercises the dependency-inference plugin + pkg-sync sync generator for both
// providers: with `inferDependencies` enabled, an `import` of a local module is
// picked up from the source, `nx sync:check` reports the drift (without writing)
// and `nx sync` writes the missing local dependency into the consuming project's
// pyproject.toml.
describe('nx-python (inferDependencies + pkg-sync)', () => {
  describe('poetry', () => {
    let ws: TestWorkspace;

    beforeAll(() => {
      ws = createTestWorkspace('infer-poetry', { inferDependencies: true });

      // Register pkg-sync as a global sync generator.
      const nxJson = ws.readJson<NxJsonConfiguration>('nx.json');
      nxJson.sync = { globalGenerators: ['@nxlv/python:pkg-sync'] };
      ws.writeJson('nx.json', nxJson);

      ws.generate(
        'poetry-project',
        `myapp --projectType application ${PY_VERSION_ARGS}`,
      );
      ws.generate(
        'poetry-project',
        `mylib --projectType library ${PY_VERSION_ARGS}`,
      );

      // Import the local library's module from the app's source (flat layout).
      ws.writeFile('myapp/myapp/__init__.py', 'import mylib\n');
    });

    afterAll(() => {
      ws?.cleanup();
    });

    it('infers the local dependency into the project graph', () => {
      ws.nx('graph --file=graph.json');
      const { graph } = ws.readJson<{ graph: ProjectGraph }>('graph.json');
      const deps = (graph.dependencies['myapp'] ?? []).map((d) => d.target);
      expect(deps).toContain('mylib');
    });

    it('sync:check reports the drift without modifying pyproject.toml', () => {
      // Out of sync: sync:check fails (non-zero) and reports, but writes nothing.
      expect(() => ws.nx('sync:check')).toThrow();
      expect(ws.readFile('myapp/pyproject.toml')).not.toContain('mylib');
    });

    it('sync writes the local dependency and leaves the workspace in sync', () => {
      ws.nx('sync');
      expect(ws.readFile('myapp/pyproject.toml')).toContain('mylib');
      // In sync now: sync:check passes.
      expect(() => ws.nx('sync:check')).not.toThrow();
    });
  });

  describe('uv', () => {
    let ws: TestWorkspace;

    beforeAll(() => {
      ws = createTestWorkspace('infer-uv', {
        packageManager: 'uv',
        inferDependencies: true,
      });

      const nxJson = ws.readJson<NxJsonConfiguration>('nx.json');
      nxJson.sync = { globalGenerators: ['@nxlv/python:pkg-sync'] };
      ws.writeJson('nx.json', nxJson);

      ws.generate(
        'uv-project',
        `myapp --projectType application --srcDir --buildSystem uv ${PY_VERSION_ARGS}`,
      );
      ws.generate(
        'uv-project',
        `mylib --projectType library --srcDir --buildSystem uv ${PY_VERSION_ARGS}`,
      );

      // Import the local library's module from the app's source (src layout).
      ws.writeFile('myapp/src/myapp/__init__.py', 'import mylib\n');
    });

    afterAll(() => {
      ws?.cleanup();
    });

    it('infers the local dependency into the project graph', () => {
      ws.nx('graph --file=graph.json');
      const { graph } = ws.readJson<{ graph: ProjectGraph }>('graph.json');
      const deps = (graph.dependencies['myapp'] ?? []).map((d) => d.target);
      expect(deps).toContain('mylib');
    });

    it('sync:check reports the drift without modifying pyproject.toml', () => {
      expect(() => ws.nx('sync:check')).toThrow();
      expect(ws.readFile('myapp/pyproject.toml')).not.toContain('mylib');
    });

    it('sync writes the local dependency and leaves the workspace in sync', () => {
      ws.nx('sync');
      expect(ws.readFile('myapp/pyproject.toml')).toContain('mylib');
      expect(() => ws.nx('sync:check')).not.toThrow();
    });
  });
});
