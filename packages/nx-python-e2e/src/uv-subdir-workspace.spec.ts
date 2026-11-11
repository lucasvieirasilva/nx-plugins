import { NxJsonConfiguration, ProjectGraph } from '@nx/devkit';
import {
  createTestWorkspace,
  PY_VERSION_ARGS,
  TestWorkspace,
  wheelFileList,
} from './utils/workspace';

type Manifest = {
  project: { dependencies?: string[] };
  tool?: { uv?: { sources?: Record<string, unknown> } };
};

// Two uv workspaces, neither at the Nx root: `python` (subapp -> sublib) and
// `spark`, whose member depends on `python`'s sublib through a path source.
describe('nx-python (uv workspaces in subdirectories)', () => {
  let ws: TestWorkspace;

  function dependOn(project: string, name: string, source: unknown): void {
    const manifest = ws.readToml<Manifest>(`${project}/pyproject.toml`);
    manifest.project.dependencies = [
      ...(manifest.project.dependencies ?? []),
      name,
    ];
    manifest.tool = {
      ...manifest.tool,
      uv: {
        ...manifest.tool?.uv,
        sources: { ...manifest.tool?.uv?.sources, [name]: source },
      },
    };
    ws.writeToml(`${project}/pyproject.toml`, manifest);
  }

  function dependencies(project: string): string[] {
    ws.nx('graph --file=graph.json');
    const { graph } = ws.readJson<{ graph: ProjectGraph }>('graph.json');
    return (graph.dependencies[project] ?? []).map((d) => d.target);
  }

  beforeAll(() => {
    ws = createTestWorkspace('uv-subdir', { packageManager: 'uv' });
    const args = `--buildSystem hatch ${PY_VERSION_ARGS}`;
    ws.generate(
      'uv-project',
      `subapp --projectType application --directory python/apps/subapp ${args}`,
    );
    ws.generate(
      'uv-project',
      `sublib --projectType library --directory python/libs/sublib ${args}`,
    );
    ws.generate(
      'uv-project',
      `subjob --projectType application --directory spark/jobs/subjob ${args}`,
    );

    ws.writeFile(
      'python/pyproject.toml',
      '[tool.uv.workspace]\nmembers = ["apps/*", "libs/*"]\n',
    );
    ws.writeFile(
      'spark/pyproject.toml',
      '[tool.uv.workspace]\nmembers = ["jobs/*"]\n',
    );
    dependOn('python/apps/subapp', 'sublib', { workspace: true });
    dependOn('spark/jobs/subjob', 'sublib', {
      path: '../../../python/libs/sublib',
    });
    ws.run('uv lock', { cwd: `${ws.dir}/python` });
    ws.run('uv lock', { cwd: `${ws.dir}/spark` });
  });

  afterAll(() => {
    ws?.cleanup();
  });

  it('links a member to another member of its uv workspace', () => {
    expect(dependencies('subapp')).toContain('sublib');
  });

  it('links a member to a member of another uv workspace', () => {
    expect(dependencies('subjob')).toContain('sublib');
  });

  it('adds an external dependency to the lock of the uv workspace', () => {
    ws.nx('run subapp:add --name lorem');
    expect(ws.readFile('python/apps/subapp/pyproject.toml')).toContain('lorem');
    expect(ws.readFile('python/uv.lock')).toContain('lorem');
    expect(ws.readFile('spark/uv.lock')).not.toContain('lorem');
    expect(ws.exists('python/apps/subapp/uv.lock')).toBe(false);
  });

  it('installs into the virtual environment of the uv workspace', () => {
    ws.nx('run subapp:install');
    expect(ws.exists('python/.venv')).toBe(true);
    expect(ws.exists('python/apps/subapp/.venv')).toBe(false);
  });

  it('bundles a member of the same uv workspace into the wheel', () => {
    ws.nx('build subapp');
    expect(wheelFileList(ws, 'python/apps/subapp')).toContain(
      'sublib/__init__.py',
    );
  });

  it('bundles a member of another uv workspace into the wheel', () => {
    ws.nx('build subjob');
    expect(wheelFileList(ws, 'spark/jobs/subjob')).toContain(
      'sublib/__init__.py',
    );

    ws.nx('build subjob --lockedVersions=false');
    expect(wheelFileList(ws, 'spark/jobs/subjob')).toContain(
      'sublib/__init__.py',
    );
  });

  it('locks every uv workspace a released project is locked in', () => {
    ws.generate('enable-releases');
    const nxJson = ws.readJson<NxJsonConfiguration>('nx.json');
    nxJson.release = {
      projects: ['subapp', 'sublib', 'subjob'],
      projectsRelationship: 'independent',
    };
    ws.writeJson('nx.json', nxJson);

    ws.nx(
      'release version 2.0.0 --projects=sublib --first-release --git-commit=false --git-tag=false',
    );

    // subapp and subjob depend on sublib, so both are bumped and the lock of
    // each uv workspace picks up the new versions.
    expect(ws.readFile('python/libs/sublib/pyproject.toml')).toContain(
      'version = "2.0.0"',
    );
    expect(ws.readFile('python/uv.lock')).toMatch(
      /name = "sublib"\nversion = "2\.0\.0"/,
    );
    expect(ws.readFile('spark/uv.lock')).toMatch(
      /name = "sublib"\nversion = "2\.0\.0"/,
    );
  });
});
