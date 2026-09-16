import { vi } from 'vitest';
import { vol } from 'memfs';
import '../../utils/mocks/cross-spawn.mock';
import '../../utils/mocks/fs.mock';
import dedent from 'string-dedent';
import { PoetryProvider } from './provider';
import { Logger } from '../../executors/utils/logger';

describe('PoetryProvider', () => {
  afterEach(() => {
    vol.reset();
    vi.resetAllMocks();
  });

  describe('updateDependencyVersions', () => {
    it('leaves a path dependency alone when no publish range is declared', () => {
      const provider = new PoetryProvider('.', new Logger());
      // Poetry forbids `version` next to `path`, so without a `[tool.nx]` range
      // there is nothing in the manifest to rewrite.
      const manifest = dedent`
        [tool.poetry]
        name = "app1"
        version = "1.3.0"

        [tool.poetry.dependencies]
        python = ">=3.9,<4"
        lib1 = { path = "../lib1", develop = true }
      `;
      vol.fromJSON({ 'apps/app1/pyproject.toml': manifest });

      const result = provider.updateDependencyVersions('apps/app1', {
        lib1: '1.4.0',
      });

      expect(result).toEqual([]);
      expect(vol.readFileSync('apps/app1/pyproject.toml', 'utf-8')).toBe(
        manifest,
      );
    });

    it('raises the lower bound of a declared publish range', () => {
      const provider = new PoetryProvider('.', new Logger());
      vol.fromJSON({
        'apps/app1/pyproject.toml': dedent`
          [tool.poetry]
          name = "app1"
          version = "1.3.0"

          [tool.poetry.dependencies]
          python = ">=3.9,<4"
          lib1 = { path = "../lib1", develop = true }

          # keep this comment
          [tool.nx.dependencies.lib1]
          range = ">=1.0.0,<2.0.0"
        `,
      });

      const result = provider.updateDependencyVersions('apps/app1', {
        lib1: '1.4.0',
      });

      const updated = vol.readFileSync(
        'apps/app1/pyproject.toml',
        'utf-8',
      ) as string;
      expect(updated).toContain('range = ">=1.4.0,<2.0.0"');
      // The ceiling is left alone and the document keeps its comments.
      expect(updated).toContain('# keep this comment');
      expect(result).toHaveLength(1);
      expect(result[0]).toContain('lib1');
    });

    it('keeps the declared lower bound when the project opts out', () => {
      const provider = new PoetryProvider('.', new Logger());
      const manifest = dedent`
        [tool.poetry]
        name = "app1"
        version = "1.3.0"

        [tool.poetry.dependencies]
        python = ">=3.9,<4"
        lib1 = { path = "../lib1", develop = true }

        [tool.nx]
        bumpLocalDependencyRange = false

        [tool.nx.dependencies.lib1]
        range = ">=1.0.0,<2.0.0"
      `;
      vol.fromJSON({ 'apps/app1/pyproject.toml': manifest });

      const result = provider.updateDependencyVersions('apps/app1', {
        lib1: '1.4.0',
      });

      expect(result).toEqual([]);
      expect(vol.readFileSync('apps/app1/pyproject.toml', 'utf-8')).toBe(
        manifest,
      );
    });

    it('keeps the declared lower bound when the workspace opts out', () => {
      // The project says nothing, so the workspace-wide plugin option applies.
      const provider = new PoetryProvider('.', new Logger(), undefined, {
        bumpLocalDependencyRange: false,
      });
      const manifest = dedent`
        [tool.poetry]
        name = "app1"
        version = "1.3.0"

        [tool.poetry.dependencies]
        python = ">=3.9,<4"
        lib1 = { path = "../lib1", develop = true }

        [tool.nx.dependencies.lib1]
        range = ">=1.0.0,<2.0.0"
      `;
      vol.fromJSON({ 'apps/app1/pyproject.toml': manifest });

      const result = provider.updateDependencyVersions('apps/app1', {
        lib1: '1.4.0',
      });

      expect(result).toEqual([]);
      expect(vol.readFileSync('apps/app1/pyproject.toml', 'utf-8')).toBe(
        manifest,
      );
    });

    it('lets the project override the workspace opt-out', () => {
      const provider = new PoetryProvider('.', new Logger(), undefined, {
        bumpLocalDependencyRange: false,
      });
      vol.fromJSON({
        'apps/app1/pyproject.toml': dedent`
          [tool.poetry]
          name = "app1"
          version = "1.3.0"

          [tool.poetry.dependencies]
          python = ">=3.9,<4"
          lib1 = { path = "../lib1", develop = true }

          [tool.nx]
          bumpLocalDependencyRange = true

          [tool.nx.dependencies.lib1]
          range = ">=1.0.0,<2.0.0"
        `,
      });

      provider.updateDependencyVersions('apps/app1', { lib1: '1.4.0' });

      expect(vol.readFileSync('apps/app1/pyproject.toml', 'utf-8')).toContain(
        'range = ">=1.4.0,<2.0.0"',
      );
    });

    it('throws when the declared range cannot allow the released version', () => {
      const provider = new PoetryProvider('.', new Logger());
      vol.fromJSON({
        'apps/app1/pyproject.toml': dedent`
          [tool.poetry]
          name = "app1"
          version = "1.3.0"

          [tool.poetry.dependencies]
          python = ">=3.9,<4"
          lib1 = { path = "../lib1", develop = true }

          [tool.nx.dependencies.lib1]
          range = ">=1.0.0,<1.3.0"
        `,
      });

      expect(() =>
        provider.updateDependencyVersions('apps/app1', { lib1: '1.4.0' }),
      ).toThrow(/does not allow 1\.4\.0/);
    });
  });
});
