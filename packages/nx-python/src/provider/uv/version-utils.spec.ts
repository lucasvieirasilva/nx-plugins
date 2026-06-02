import { rewriteDependencySpecifier } from './version-utils';

describe('rewriteDependencySpecifier', () => {
  describe('updatable operators (preserve operator + precision)', () => {
    it.each([
      ['lib1~=1.1', 'lib1~=1.4'],
      ['lib1~=1.1.0', 'lib1~=1.4.0'],
      ['lib1==1.1.0', 'lib1==1.4.0'],
      ['lib1==1.1', 'lib1==1.4'],
      ['lib1===1.1.0', 'lib1===1.4.0'],
      ['lib1>=1.0', 'lib1>=1.4'],
      ['lib1>=1.0.0', 'lib1>=1.4.0'],
    ])('rewrites %s -> %s', (input, expected) => {
      const { changed, result } = rewriteDependencySpecifier(
        input,
        'lib1',
        '1.4.0',
      );
      expect(changed).toBe(true);
      expect(result).toBe(expected);
    });

    it('zero-pads when the new version has fewer components than the precision', () => {
      const { result } = rewriteDependencySpecifier('lib1==1.1.0', 'lib1', '2');
      expect(result).toBe('lib1==2.0.0');
    });
  });

  describe('kept operators', () => {
    it.each(['lib1>1.0', 'lib1<2.0', 'lib1<=2.0', 'lib1!=1.1'])(
      'leaves %s untouched',
      (input) => {
        const { changed, result } = rewriteDependencySpecifier(
          input,
          'lib1',
          '1.4.0',
        );
        expect(changed).toBe(false);
        expect(result).toBe(input);
      },
    );
  });

  describe('compound ranges', () => {
    it('updates the lower bound and keeps the ceiling', () => {
      const { changed, result } = rewriteDependencySpecifier(
        'lib1>=1.0,<2.0',
        'lib1',
        '1.4.0',
      );
      expect(changed).toBe(true);
      expect(result).toBe('lib1>=1.4,<2.0');
    });

    it('normalizes whitespace inside the specifier', () => {
      const { result } = rewriteDependencySpecifier(
        'lib1 >= 1.0, < 2.0',
        'lib1',
        '1.4.0',
      );
      expect(result).toBe('lib1>=1.4,<2.0');
    });
  });

  describe('extras and markers', () => {
    it('preserves extras', () => {
      const { result } = rewriteDependencySpecifier(
        'lib1[color]~=1.1',
        'lib1',
        '1.4.0',
      );
      expect(result).toBe('lib1[color]~=1.4');
    });

    it('preserves environment markers', () => {
      const { result } = rewriteDependencySpecifier(
        'lib1~=1.1 ; python_version < "3.9"',
        'lib1',
        '1.4.0',
      );
      expect(result).toBe('lib1~=1.4 ; python_version < "3.9"');
    });
  });

  describe('no-op cases', () => {
    it('leaves a dependency without a specifier untouched', () => {
      const { changed, result } = rewriteDependencySpecifier(
        'lib1',
        'lib1',
        '1.4.0',
      );
      expect(changed).toBe(false);
      expect(result).toBe('lib1');
    });

    it('does not touch a different package', () => {
      const { changed, result } = rewriteDependencySpecifier(
        'other-lib~=1.1',
        'lib1',
        '1.4.0',
      );
      expect(changed).toBe(false);
      expect(result).toBe('other-lib~=1.1');
    });

    it('matches package names using PEP 503 normalization', () => {
      const { changed, result } = rewriteDependencySpecifier(
        'My_Lib~=1.1',
        'my-lib',
        '1.4.0',
      );
      expect(changed).toBe(true);
      expect(result).toBe('My_Lib~=1.4');
    });
  });

  describe('prefix-match wildcards', () => {
    it('bumps an == wildcard while preserving the wildcard', () => {
      const { changed, result } = rewriteDependencySpecifier(
        'lib1==1.1.*',
        'lib1',
        '1.4.0',
      );
      expect(changed).toBe(true);
      expect(result).toBe('lib1==1.4.*');
    });

    it('leaves an == wildcard that already covers the release unchanged', () => {
      const { changed, result } = rewriteDependencySpecifier(
        'lib1==1.*',
        'lib1',
        '1.4.0',
      );
      expect(changed).toBe(false);
      expect(result).toBe('lib1==1.*');
    });

    it('keeps a != wildcard that still allows the release', () => {
      const { changed, result } = rewriteDependencySpecifier(
        'lib1!=1.1.*',
        'lib1',
        '1.4.0',
      );
      expect(changed).toBe(false);
      expect(result).toBe('lib1!=1.1.*');
    });

    it('throws when a != wildcard excludes the release', () => {
      expect(() =>
        rewriteDependencySpecifier('lib1!=1.4.*', 'lib1', '1.4.0'),
      ).toThrow(/does not allow 1.4.0/);
    });
  });

  describe('satisfiability validation', () => {
    it('throws when a kept ceiling excludes the released version', () => {
      expect(() =>
        rewriteDependencySpecifier('lib1>=1.0,<1.3', 'lib1', '1.4.0'),
      ).toThrow(/does not allow 1.4.0/);
    });

    it('throws when a standalone ceiling excludes the released version', () => {
      expect(() =>
        rewriteDependencySpecifier('lib1<1.3', 'lib1', '1.4.0'),
      ).toThrow(/does not allow 1.4.0/);
    });

    it('throws when an exclusion matches the released version', () => {
      expect(() =>
        rewriteDependencySpecifier('lib1!=1.4.0', 'lib1', '1.4.0'),
      ).toThrow(/does not allow 1.4.0/);
    });

    it('does not throw when the ceiling still allows the released version', () => {
      expect(() =>
        rewriteDependencySpecifier('lib1>=1.0,<2.0', 'lib1', '1.4.0'),
      ).not.toThrow();
    });
  });
});
