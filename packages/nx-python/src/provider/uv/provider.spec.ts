import { vi } from 'vitest';
import { vol } from 'memfs';
import '../../utils/mocks/cross-spawn.mock';
import '../../utils/mocks/fs.mock';
import dedent from 'string-dedent';
import { UVProvider } from './provider';
import { Logger } from '../../executors/utils/logger';

describe('UVProvider', () => {
  let provider: UVProvider;

  beforeEach(() => {
    provider = new UVProvider('.', new Logger());
  });

  afterEach(() => {
    vol.reset();
    vi.resetAllMocks();
  });

  describe('updateDependencyVersions', () => {
    it('returns an empty array when there are no dependencies to update', () => {
      vol.fromJSON({
        'apps/app1/pyproject.toml': dedent`
          [project]
          name = "app1"
          version = "1.3.0"
          dependencies = [ "lib1~=1.1" ]

          [tool.uv.sources.lib1]
          workspace = true
        `,
      });

      const result = provider.updateDependencyVersions('apps/app1', {});

      expect(result).toEqual([]);
    });

    it('rewrites version ranges across main, optional and group dependencies', () => {
      vol.fromJSON({
        'apps/app1/pyproject.toml': dedent`
          [project]
          name = "app1"
          version = "1.3.0"
          dependencies = [ "lib1~=1.1", "lib2>=1.2,<2.0", "requests>=2.0" ]

          [project.optional-dependencies]
          extra = [ "lib3==1.0.0" ]

          [dependency-groups]
          dev = [ "lib4~=1.0" ]

          [tool.uv.sources.lib1]
          workspace = true
          [tool.uv.sources.lib2]
          workspace = true
          [tool.uv.sources.lib3]
          workspace = true
          [tool.uv.sources.lib4]
          workspace = true
        `,
      });

      const result = provider.updateDependencyVersions('apps/app1', {
        lib1: '1.4.0',
        lib2: '1.5.2',
        lib3: '2.0.0',
        lib4: '1.9.0',
      });

      expect(result).toEqual([
        '✍️  Updated workspace dependency versions in manifest: apps/app1/pyproject.toml',
      ]);

      const data = provider.getPyprojectToml('apps/app1');
      expect(data.project.dependencies).toEqual([
        'lib1~=1.4',
        'lib2>=1.5,<2.0',
        'requests>=2.0',
      ]);
      expect(data.project['optional-dependencies'].extra).toEqual([
        'lib3==2.0.0',
      ]);
      expect(data['dependency-groups'].dev).toEqual(['lib4~=1.9']);
    });

    it('leaves dependencies without a version specifier untouched', () => {
      vol.fromJSON({
        'apps/app1/pyproject.toml': dedent`
          [project]
          name = "app1"
          version = "1.3.0"
          dependencies = [ "lib1" ]

          [tool.uv.sources.lib1]
          workspace = true
        `,
      });

      const result = provider.updateDependencyVersions('apps/app1', {
        lib1: '1.4.0',
      });

      expect(result).toEqual([]);
      expect(
        provider.getPyprojectToml('apps/app1').project.dependencies,
      ).toEqual(['lib1']);
    });

    it('throws when the resulting specifier excludes the released version', () => {
      vol.fromJSON({
        'apps/app1/pyproject.toml': dedent`
          [project]
          name = "app1"
          version = "1.3.0"
          dependencies = [ "lib1>=1.0,<1.3" ]

          [tool.uv.sources.lib1]
          workspace = true
        `,
      });

      expect(() =>
        provider.updateDependencyVersions('apps/app1', { lib1: '1.4.0' }),
      ).toThrow(/does not allow 1.4.0/);
    });
  });
});
