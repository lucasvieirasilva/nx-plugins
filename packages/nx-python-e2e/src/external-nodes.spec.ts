import {
  createTestWorkspace,
  PY_VERSION_ARGS,
  TestWorkspace,
} from './utils/workspace';

// With `externalNodes` enabled, each project's locked packages become `pypi:`
// external nodes, and a project depends only on the ones it installs. The
// graph file (`nx graph --file`) leaves external nodes out, so this reads the
// project graph Nx caches instead.
type LockedGraph = {
  externalNodes: Record<string, { type: string; data: { version: string } }>;
  dependencies: Record<string, string[]>;
};

function readLockedGraph(ws: TestWorkspace): LockedGraph {
  ws.nx('show projects');
  return JSON.parse(
    ws.run(
      `node -e "const { readCachedProjectGraph } = require('nx/src/devkit-exports');` +
        ` const g = readCachedProjectGraph();` +
        ` const pypi = Object.fromEntries(Object.entries(g.externalNodes).filter(([n]) => n.startsWith('pypi:')));` +
        ` const deps = Object.fromEntries(Object.entries(g.dependencies).map(([p, d]) => [p, d.map((x) => x.target).filter((t) => t.startsWith('pypi:'))]));` +
        ` console.log(JSON.stringify({ externalNodes: pypi, dependencies: deps }));"`,
    ),
  );
}

describe('nx-python (externalNodes)', () => {
  describe.each([
    {
      packageManager: 'uv' as const,
      generator: 'uv-project',
      args: '--srcDir --buildSystem uv',
    },
    {
      packageManager: 'poetry' as const,
      generator: 'poetry-project',
      args: '',
    },
  ])('$packageManager', ({ packageManager, generator, args }) => {
    let ws: TestWorkspace;

    beforeAll(() => {
      ws = createTestWorkspace(`external-nodes-${packageManager}`, {
        packageManager,
        externalNodes: true,
      });
      ws.generate(
        generator,
        `extapp --projectType application ${args} ${PY_VERSION_ARGS}`,
      );
      ws.generate(
        generator,
        `extlib --projectType library ${args} ${PY_VERSION_ARGS}`,
      );
      ws.nx('run extapp:add --name six');
      ws.nx('run extlib:add --name idna');
    });

    afterAll(() => {
      ws?.cleanup();
    });

    it('adds the locked packages to the project graph as pypi external nodes', () => {
      const { externalNodes } = readLockedGraph(ws);

      expect(externalNodes['pypi:six']).toMatchObject({ type: 'pypi' });
      expect(externalNodes['pypi:idna']).toMatchObject({ type: 'pypi' });
    });

    it('makes each project depend only on the packages it installs', () => {
      const { dependencies } = readLockedGraph(ws);

      expect(dependencies['extapp']).toContain('pypi:six');
      expect(dependencies['extapp']).not.toContain('pypi:idna');
      expect(dependencies['extlib']).toContain('pypi:idna');
      expect(dependencies['extlib']).not.toContain('pypi:six');
    });
  });

  // In a shared workspace every member's edges come from the one root lock, so
  // two members installing the same package must both keep their edge to it.
  describe.each([
    {
      packageManager: 'uv' as const,
      generator: 'uv-project',
      args: '--srcDir --buildSystem uv',
    },
    {
      packageManager: 'poetry' as const,
      generator: 'poetry-project',
      args: '',
    },
  ])(
    '$packageManager shared workspace',
    ({ packageManager, generator, args }) => {
      let ws: TestWorkspace;

      beforeAll(() => {
        ws = createTestWorkspace(`external-nodes-${packageManager}-shared`, {
          packageManager,
          externalNodes: true,
        });
        ws.generate(
          generator,
          `shapp --projectType application ${args} ${PY_VERSION_ARGS}`,
        );
        ws.generate(
          generator,
          `shlib --projectType library ${args} ${PY_VERSION_ARGS}`,
        );
        ws.generate(
          'migrate-to-shared-venv',
          `--packageManager=${packageManager} --moveDevDependencies=true ${PY_VERSION_ARGS}`,
        );
        ws.nx('run shapp:add --name six');
        ws.nx('run shlib:add --name six');
        ws.nx('run shlib:add --name idna');
      });

      afterAll(() => {
        ws?.cleanup();
      });

      it('gives every member an edge to a package they both install', () => {
        const { dependencies } = readLockedGraph(ws);

        expect(dependencies['shapp']).toContain('pypi:six');
        expect(dependencies['shlib']).toContain('pypi:six');
        expect(dependencies['shlib']).toContain('pypi:idna');
        expect(dependencies['shapp']).not.toContain('pypi:idna');
      });
    },
  );
});
