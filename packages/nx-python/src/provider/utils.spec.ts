import { sep } from 'path';
import { pycacheFilter } from './utils';

describe('pycacheFilter', () => {
  it('allows regular source files', () => {
    expect(
      pycacheFilter(['libs', 'mylib', 'src', 'mylib', 'mod.py'].join(sep)),
    ).toBe(true);
    expect(pycacheFilter(['libs', 'mylib', 'pyproject.toml'].join(sep))).toBe(
      true,
    );
  });

  it('excludes __pycache__ directories at any depth', () => {
    expect(pycacheFilter(['libs', 'mylib', '__pycache__'].join(sep))).toBe(
      false,
    );
    expect(
      pycacheFilter(['libs', 'mylib', 'src', 'mylib', '__pycache__'].join(sep)),
    ).toBe(false);
  });

  it('excludes files inside __pycache__', () => {
    expect(
      pycacheFilter(
        ['libs', 'mylib', '__pycache__', 'mod.cpython-314.pyc'].join(sep),
      ),
    ).toBe(false);
    expect(
      pycacheFilter(
        [
          'libs',
          'mylib',
          '__pycache__',
          'mod.cpython-314.pyc.139819699349712',
        ].join(sep),
      ),
    ).toBe(false);
  });

  it('does not exclude paths that merely contain __pycache__ as a substring', () => {
    expect(pycacheFilter(['libs', 'my__pycache__thing'].join(sep))).toBe(true);
    expect(pycacheFilter(['libs', 'prefix__pycache__'].join(sep))).toBe(true);
  });
});
