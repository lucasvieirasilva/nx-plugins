import { NxJsonConfiguration, ProjectConfiguration } from '@nx/devkit';
import {
  createTestWorkspace,
  PY_VERSION_ARGS,
  TestWorkspace,
} from './utils/workspace';

// Reads the `version = "x.y.z"` from a project's pyproject.toml.
function projectVersion(
  ws: TestWorkspace,
  project: string,
): string | undefined {
  return ws
    .readFile(`${project}/pyproject.toml`)
    .match(/version = "([^"]+)"/)?.[1];
}

// Exercises the release integration: `enable-releases` wires each project into
// Nx release with `@nxlv/python/release/version-actions`, `nx release version`
// bumps a project's pyproject.toml, and bumping a local dependency cascades a
// bump to its dependents. Covered for both Poetry and uv.
describe('nx-python (release version-actions)', () => {
  describe('poetry', () => {
    let ws: TestWorkspace;

    beforeAll(() => {
      ws = createTestWorkspace('release-poetry');
      ws.generate(
        'poetry-project',
        `relapp --projectType application ${PY_VERSION_ARGS}`,
      );
      ws.generate(
        'poetry-project',
        `rellib --projectType library ${PY_VERSION_ARGS}`,
      );
      // relapp depends on rellib so the dependent-bump cascade can be exercised.
      ws.nx('run relapp:add --name rellib --local');
      ws.generate('enable-releases');

      const nxJson = ws.readJson<NxJsonConfiguration>('nx.json');
      nxJson.release = {
        projects: ['relapp', 'rellib'],
        projectsRelationship: 'independent',
      };
      ws.writeJson('nx.json', nxJson);
    });

    afterAll(() => {
      ws?.cleanup();
    });

    it('wires the version-actions into the project configuration', () => {
      const project = ws.readJson<ProjectConfiguration>('rellib/project.json');
      expect(project.release?.version?.versionActions).toBe(
        '@nxlv/python/release/version-actions',
      );
    });

    it('bumps the pyproject.toml version via nx release', () => {
      ws.nx(
        'release version 9.9.9 --projects=relapp --first-release --git-commit=false --git-tag=false',
      );
      expect(projectVersion(ws, 'relapp')).toBe('9.9.9');
    });

    it('bumps a dependent project when its local dependency is bumped', () => {
      // relapp is at 9.9.9 from the previous test; bumping its local dependency
      // rellib to 2.0.0 cascades a patch bump to relapp (9.9.9 -> 9.9.10).
      ws.nx(
        'release version 2.0.0 --projects=rellib --first-release --git-commit=false --git-tag=false',
      );

      // The bumped dependency gets the explicit version...
      expect(projectVersion(ws, 'rellib')).toBe('2.0.0');
      // ...and its dependent gets a patch bump because a dependency changed.
      expect(projectVersion(ws, 'relapp')).toBe('9.9.10');
    });
  });

  describe('uv', () => {
    let ws: TestWorkspace;

    beforeAll(() => {
      ws = createTestWorkspace('release-uv', { packageManager: 'uv' });
      ws.generate(
        'uv-project',
        `relapp --projectType application --srcDir --buildSystem uv ${PY_VERSION_ARGS}`,
      );
      ws.generate(
        'uv-project',
        `rellib --projectType library --srcDir --buildSystem uv ${PY_VERSION_ARGS}`,
      );
      ws.nx('run relapp:add --name rellib --local');
      ws.generate('enable-releases');

      const nxJson = ws.readJson<NxJsonConfiguration>('nx.json');
      nxJson.release = {
        projects: ['relapp', 'rellib'],
        projectsRelationship: 'independent',
      };
      ws.writeJson('nx.json', nxJson);
    });

    afterAll(() => {
      ws?.cleanup();
    });

    it('wires the version-actions into the project configuration', () => {
      const project = ws.readJson<ProjectConfiguration>('rellib/project.json');
      expect(project.release?.version?.versionActions).toBe(
        '@nxlv/python/release/version-actions',
      );
    });

    it('bumps the pyproject.toml version via nx release', () => {
      ws.nx(
        'release version 9.9.9 --projects=relapp --first-release --git-commit=false --git-tag=false',
      );
      expect(projectVersion(ws, 'relapp')).toBe('9.9.9');
    });

    it('bumps a dependent project when its local dependency is bumped', () => {
      // relapp is at 9.9.9 from the previous test; bumping its local dependency
      // rellib to 2.0.0 cascades a patch bump to relapp (9.9.9 -> 9.9.10).
      ws.nx(
        'release version 2.0.0 --projects=rellib --first-release --git-commit=false --git-tag=false',
      );

      // The bumped dependency gets the explicit version...
      expect(projectVersion(ws, 'rellib')).toBe('2.0.0');
      // ...and its dependent gets a patch bump because a dependency changed.
      expect(projectVersion(ws, 'relapp')).toBe('9.9.10');
    });
  });
});
