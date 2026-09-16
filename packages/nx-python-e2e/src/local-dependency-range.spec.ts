import { NxJsonConfiguration, ProjectConfiguration } from '@nx/devkit';
import type { PoetryPyprojectToml, UVPyprojectToml } from '@nxlv/python';
import {
  createTestWorkspace,
  PY_VERSION_ARGS,
  TestWorkspace,
  wheelRequirement,
} from './utils/workspace';

// Exercises publishing a local workspace dependency with a version range
// instead of the exact-version pin the build emits by default.
//
// This only applies in publish mode (`lockedVersions: false` +
// `bundleLocalDependencies: false`), where the built distribution references
// its local dependencies by version rather than bundling them.
//
// The two providers express the range differently, because Poetry cannot put a
// `version` next to a `path` dependency and rejects unknown keys inside the
// dependency table:
//  - uv: a standard PEP 621 specifier in `project.dependencies`;
//  - Poetry: a `range` key under `[tool.nx.dependencies.<package>]`.
// Both must produce the same `Requires-Dist` in the wheel.

/**
 * The clauses of a wheel's version constraint, normalized.
 *
 * Build backends are free to reorder and re-punctuate a specifier: Poetry emits
 * `(>=1.0.0,<2.0.0)` while hatchling emits `<2.0.0,>=1.0.0`. Comparing the
 * sorted clause set keeps the assertions about intent rather than formatting.
 */
function requirementClauses(
  ws: TestWorkspace,
  projectDir: string,
  packageName: string,
): string[] {
  return wheelRequirement(ws, projectDir, packageName)
    .replace(/[()\s]/g, '')
    .split(',')
    .filter(Boolean)
    .sort();
}

/**
 * Switches a project's build target into publish mode.
 *
 * Note the projects are generated `--publishable`: in publish mode the build
 * bundles any local dependency whose own build target sets `publish: false`,
 * which would leave no `Requires-Dist` line to assert on.
 */
function usePublishMode(ws: TestWorkspace, project: string) {
  const path = `${project}/project.json`;
  const config = ws.readJson<ProjectConfiguration>(path);
  config.targets.build.options = {
    ...config.targets.build.options,
    lockedVersions: false,
    bundleLocalDependencies: false,
  };
  ws.writeJson(path, config);
}

/** Registers both projects with Nx release so `nx release version` can run. */
function enableReleases(ws: TestWorkspace, projects: string[]) {
  ws.generate('enable-releases');
  const nxJson = ws.readJson<NxJsonConfiguration>('nx.json');
  nxJson.release = { projects, projectsRelationship: 'independent' };
  ws.writeJson('nx.json', nxJson);
}

/** Sets the workspace-wide `bumpLocalDependencyRange` plugin option. */
function setPluginBumpOption(ws: TestWorkspace, value: boolean) {
  const nxJson = ws.readJson<NxJsonConfiguration>('nx.json');
  nxJson.plugins = (nxJson.plugins ?? []).map((plugin) =>
    typeof plugin === 'object' && plugin.plugin === '@nxlv/python'
      ? {
          ...plugin,
          options: {
            ...(plugin.options as Record<string, unknown>),
            bumpLocalDependencyRange: value,
          },
        }
      : plugin,
  );
  ws.writeJson('nx.json', nxJson);
}

describe('nx-python (local dependency version range)', () => {
  describe('poetry', () => {
    let ws: TestWorkspace;

    beforeAll(() => {
      ws = createTestWorkspace('range-poetry');
      ws.generate(
        'poetry-project',
        `rangeapp --projectType application --publishable ${PY_VERSION_ARGS}`,
      );
      ws.generate(
        'poetry-project',
        `rangelib --projectType library --publishable ${PY_VERSION_ARGS}`,
      );
      ws.nx('run rangeapp:add --name rangelib --local');
      usePublishMode(ws, 'rangeapp');
      enableReleases(ws, ['rangeapp', 'rangelib']);
    });

    afterAll(() => {
      ws?.cleanup();
    });

    it('pins the exact version when no range is declared', () => {
      ws.nx('build rangeapp');

      expect(requirementClauses(ws, 'rangeapp', 'rangelib')).toEqual([
        '==1.0.0',
      ]);
    });

    it('publishes the range declared under tool.nx', () => {
      const manifest = ws.readToml<PoetryPyprojectToml>(
        'rangeapp/pyproject.toml',
      );
      manifest.tool.nx = {
        ...manifest.tool.nx,
        dependencies: { rangelib: { range: '>=1.0.0,<2.0.0' } },
      };
      ws.writeToml('rangeapp/pyproject.toml', manifest);

      ws.nx('build rangeapp');

      expect(requirementClauses(ws, 'rangeapp', 'rangelib')).toEqual([
        '<2.0.0',
        '>=1.0.0',
      ]);
    });

    it('does not disturb poetry: the manifest still locks and builds', () => {
      // `tool.nx` is an unknown namespace to Poetry, which must ignore it.
      expect(() => ws.nx('run rangeapp:lock')).not.toThrow();
    });

    it('raises the declared lower bound when the dependency is released', () => {
      ws.nx(
        'release version 1.3.0 --projects=rangelib --first-release --git-commit=false --git-tag=false',
      );

      const manifest = ws.readToml<PoetryPyprojectToml>(
        'rangeapp/pyproject.toml',
      );
      // The floor tracks the release; the ceiling is left alone.
      expect(manifest.tool.nx.dependencies['rangelib'].range).toBe(
        '>=1.3.0,<2.0.0',
      );
    });

    it('keeps the declared lower bound when the project opts out', () => {
      const manifest = ws.readToml<PoetryPyprojectToml>(
        'rangeapp/pyproject.toml',
      );
      manifest.tool.nx.bumpLocalDependencyRange = false;
      ws.writeToml('rangeapp/pyproject.toml', manifest);

      ws.nx(
        'release version 1.5.0 --projects=rangelib --first-release --git-commit=false --git-tag=false',
      );

      const after = ws.readToml<PoetryPyprojectToml>('rangeapp/pyproject.toml');
      expect(after.tool.nx.dependencies['rangelib'].range).toBe(
        '>=1.3.0,<2.0.0',
      );
    });

    it('keeps the declared lower bound when the workspace opts out', () => {
      // Drop the project-level override so the plugin option is what applies.
      const manifest = ws.readToml<PoetryPyprojectToml>(
        'rangeapp/pyproject.toml',
      );
      delete manifest.tool.nx.bumpLocalDependencyRange;
      ws.writeToml('rangeapp/pyproject.toml', manifest);
      setPluginBumpOption(ws, false);

      ws.nx(
        'release version 1.7.0 --projects=rangelib --first-release --git-commit=false --git-tag=false',
      );

      const after = ws.readToml<PoetryPyprojectToml>('rangeapp/pyproject.toml');
      expect(after.tool.nx.dependencies['rangelib'].range).toBe(
        '>=1.3.0,<2.0.0',
      );
    });

    it('still publishes the declared range after the releases', () => {
      ws.nx('build rangeapp');

      expect(requirementClauses(ws, 'rangeapp', 'rangelib')).toEqual([
        '<2.0.0',
        '>=1.3.0',
      ]);
    });
  });

  describe('uv', () => {
    let ws: TestWorkspace;

    beforeAll(() => {
      ws = createTestWorkspace('range-uv', { packageManager: 'uv' });
      ws.generate(
        'uv-project',
        `uvrangeapp --projectType application --buildSystem hatch --publishable ${PY_VERSION_ARGS}`,
      );
      ws.generate(
        'uv-project',
        `uvrangelib --projectType library --buildSystem hatch --publishable ${PY_VERSION_ARGS}`,
      );
      ws.nx('run uvrangeapp:add --name uvrangelib --local');
      usePublishMode(ws, 'uvrangeapp');
      enableReleases(ws, ['uvrangeapp', 'uvrangelib']);
    });

    afterAll(() => {
      ws?.cleanup();
    });

    it('pins the exact version when no range is declared', () => {
      ws.nx('build uvrangeapp');

      expect(requirementClauses(ws, 'uvrangeapp', 'uvrangelib')).toEqual([
        '==1.0.0',
      ]);
    });

    it('publishes a range written in the project dependencies', () => {
      const manifest = ws.readToml<UVPyprojectToml>(
        'uvrangeapp/pyproject.toml',
      );
      manifest.project.dependencies = manifest.project.dependencies.map(
        (dep) =>
          dep.startsWith('uvrangelib') ? 'uvrangelib>=1.0.0,<2.0.0' : dep,
      );
      ws.writeToml('uvrangeapp/pyproject.toml', manifest);

      ws.nx('build uvrangeapp');

      expect(requirementClauses(ws, 'uvrangeapp', 'uvrangelib')).toEqual([
        '<2.0.0',
        '>=1.0.0',
      ]);
    });

    it('raises the declared lower bound when the dependency is released', () => {
      ws.nx(
        'release version 1.3.0 --projects=uvrangelib --first-release --git-commit=false --git-tag=false',
      );

      const manifest = ws.readToml<UVPyprojectToml>(
        'uvrangeapp/pyproject.toml',
      );
      expect(manifest.project.dependencies).toContain(
        'uvrangelib>=1.3.0,<2.0.0',
      );
    });

    it('keeps the declared lower bound when the project opts out', () => {
      const manifest = ws.readToml<UVPyprojectToml>(
        'uvrangeapp/pyproject.toml',
      );
      manifest.tool.nx = { bumpLocalDependencyRange: false };
      ws.writeToml('uvrangeapp/pyproject.toml', manifest);

      ws.nx(
        'release version 1.5.0 --projects=uvrangelib --first-release --git-commit=false --git-tag=false',
      );

      const after = ws.readToml<UVPyprojectToml>('uvrangeapp/pyproject.toml');
      expect(after.project.dependencies).toContain('uvrangelib>=1.3.0,<2.0.0');
    });

    it('keeps the declared lower bound when the workspace opts out', () => {
      const manifest = ws.readToml<UVPyprojectToml>(
        'uvrangeapp/pyproject.toml',
      );
      delete manifest.tool.nx;
      ws.writeToml('uvrangeapp/pyproject.toml', manifest);
      setPluginBumpOption(ws, false);

      ws.nx(
        'release version 1.7.0 --projects=uvrangelib --first-release --git-commit=false --git-tag=false',
      );

      const after = ws.readToml<UVPyprojectToml>('uvrangeapp/pyproject.toml');
      expect(after.project.dependencies).toContain('uvrangelib>=1.3.0,<2.0.0');
    });

    it('still publishes the declared range after the releases', () => {
      ws.nx('build uvrangeapp');

      expect(requirementClauses(ws, 'uvrangeapp', 'uvrangelib')).toEqual([
        '<2.0.0',
        '>=1.3.0',
      ]);
    });
  });
});
