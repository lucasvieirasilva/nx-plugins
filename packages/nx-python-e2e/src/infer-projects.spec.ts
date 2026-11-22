import { ProjectGraph } from '@nx/devkit';
import {
  createTestWorkspace,
  PY_VERSION_ARGS,
  TestWorkspace,
} from './utils/workspace';

// With `inferProjects` enabled, a `pyproject.toml` is enough to make an Nx
// project: the generators write no `project.json` with `--skipProjectJson`, and
// the projects, their targets and the edge between them still come out of the
// graph.
describe('nx-python (inferProjects)', () => {
  describe.each([
    {
      packageManager: 'uv' as const,
      generator: 'uv-project',
      args: '--srcDir --buildSystem uv',
      lockFile: 'uv.lock',
    },
    {
      packageManager: 'poetry' as const,
      generator: 'poetry-project',
      args: '',
      lockFile: 'poetry.lock',
    },
  ])('$packageManager', ({ packageManager, generator, args, lockFile }) => {
    let ws: TestWorkspace;

    const affected = (file: string): string[] =>
      JSON.parse(
        ws.nx(`show projects --affected --files=${file} --json`),
      ).sort();

    beforeAll(() => {
      ws = createTestWorkspace(`infer-projects-${packageManager}`, {
        packageManager,
      });
      // migrate-to-shared-venv finds the projects through their project.json,
      // so the shared workspace comes first and the projects are generated
      // into it.
      ws.generate(
        'migrate-to-shared-venv',
        `--packageManager=${packageManager} --moveDevDependencies=true ${PY_VERSION_ARGS}`,
      );
      ws.generate(
        generator,
        `infapp --projectType application --skipProjectJson ${args} ${PY_VERSION_ARGS}`,
      );
      ws.generate(
        generator,
        `inflib --projectType library --skipProjectJson ${args} ${PY_VERSION_ARGS}`,
      );
      ws.nx('run infapp:add --name inflib --local');
    });

    afterAll(() => {
      ws?.cleanup();
    });

    it('creates a project for each pyproject.toml that names a package', () => {
      const projects = JSON.parse(ws.nx('show projects --json'));

      expect(ws.exists('infapp/project.json')).toBe(false);
      expect(ws.exists('inflib/project.json')).toBe(false);
      expect(projects).toContain('infapp');
      expect(projects).toContain('inflib');
    });

    it('infers the targets the generators write', () => {
      const project = JSON.parse(ws.nx('show project inflib --json'));

      expect(Object.keys(project.targets)).toEqual(
        expect.arrayContaining([
          'lock',
          'sync',
          'add',
          'update',
          'remove',
          'build',
          'lint',
          'test',
          'install',
        ]),
      );
    });

    it('keeps the edge to a local dependency', () => {
      ws.nx('graph --file=graph.json');
      const { graph } = ws.readJson<{ graph: ProjectGraph }>('graph.json');

      expect(graph.dependencies['infapp'].map((d) => d.target)).toContain(
        'inflib',
      );
    });

    it('infers a test target that reads its dependencies production files', () => {
      const project = JSON.parse(ws.nx('show project infapp --json'));

      expect(project.targets.test.inputs).toEqual(
        expect.arrayContaining([
          'default',
          '^production',
          `{workspaceRoot}/${lockFile}`,
        ]),
      );
    });

    it('affects every member when the workspace lock file changes', () => {
      expect(affected(lockFile)).toEqual(
        expect.arrayContaining(['infapp', 'inflib']),
      );
    });
  });
});
