import { vi } from 'vitest';
import { vol } from 'memfs';
import '../../utils/mocks/cross-spawn.mock';
import '../../utils/mocks/fs.mock';
import dedent from 'string-dedent';
import { PoetryProvider } from './provider';
import { Logger } from '../../executors/utils/logger';

describe('PoetryProvider', () => {
  let provider: PoetryProvider;

  beforeEach(() => {
    provider = new PoetryProvider('.', new Logger());
  });

  afterEach(() => {
    vol.reset();
    vi.resetAllMocks();
  });

  describe('updateDependencyVersions', () => {
    it('is a no-op and never rewrites the manifest', () => {
      const manifest = dedent`
        [tool.poetry]
        name = "app1"
        version = "1.3.0"

        [tool.poetry.dependencies]
        python = ">=3.9,<4"
        lib1 = { path = "../lib1", develop = true }
      `;
      vol.fromJSON({ 'apps/app1/pyproject.toml': manifest });

      const result = provider.updateDependencyVersions();

      expect(result).toEqual([]);
      expect(vol.readFileSync('apps/app1/pyproject.toml', 'utf-8')).toBe(
        manifest,
      );
    });
  });
});
