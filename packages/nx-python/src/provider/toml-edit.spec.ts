import { replaceStringLiterals, setTableStringValue } from './toml-edit';

describe('setTableStringValue', () => {
  it('rewrites the value and keeps every comment and blank line', () => {
    const source = [
      '[project]',
      '# The distribution name, matched by the release tooling.',
      'name = "demo"',
      'version = "1.2.3"',
      '',
      '# Runtime dependencies.',
      'dependencies = [ "requests~=2.0" ]',
      '',
      '[tool.ruff]',
      'line-length = 90',
      '',
    ].join('\n');

    const { changed, result } = setTableStringValue(
      source,
      'project',
      'version',
      '2.0.0',
    );

    expect(changed).toBe(true);
    expect(result).toBe(source.replace('"1.2.3"', '"2.0.0"'));
  });

  it('keeps a trailing comment on the rewritten line', () => {
    const source = '[project]\nversion = "1.0.0"  # bumped by the release\n';

    const { result } = setTableStringValue(
      source,
      'project',
      'version',
      '1.1.0',
    );

    expect(result).toBe(
      '[project]\nversion = "1.1.0"  # bumped by the release\n',
    );
  });

  it('preserves single-line-string quoting style of neighbours', () => {
    const source = "[project]\nname = 'demo'\nversion = '1.0.0'\n";

    const { changed, result } = setTableStringValue(
      source,
      'project',
      'version',
      '1.1.0',
    );

    expect(changed).toBe(true);
    expect(result).toBe('[project]\nname = \'demo\'\nversion = "1.1.0"\n');
  });

  it('finds a dotted table', () => {
    const source = '[tool.poetry]\nname = "demo"\nversion = "0.1.0"\n';

    const { changed, result } = setTableStringValue(
      source,
      'tool.poetry',
      'version',
      '0.2.0',
    );

    expect(changed).toBe(true);
    expect(result).toContain('version = "0.2.0"');
  });

  it('does not reach into a sub-table', () => {
    const source = [
      '[project]',
      'name = "demo"',
      '',
      '[project.urls]',
      'version = "not-the-project-version"',
      '',
    ].join('\n');

    const { changed, result } = setTableStringValue(
      source,
      'project',
      'version',
      '9.9.9',
    );

    expect(changed).toBe(false);
    expect(result).toBe(source);
  });

  it('reports no match when the table is absent', () => {
    const source = '[tool.ruff]\nline-length = 90\n';

    expect(setTableStringValue(source, 'project', 'version', '1.0.0')).toEqual({
      changed: false,
      result: source,
    });
  });

  it('reports no match when the key is absent, leaving insertion to the caller', () => {
    const source = '[project]\nname = "demo"\ndynamic = ["version"]\n';

    expect(setTableStringValue(source, 'project', 'version', '1.0.0')).toEqual({
      changed: false,
      result: source,
    });
  });
});

describe('replaceStringLiterals', () => {
  it('rewrites specifiers across every dependency group, keeping comments', () => {
    const source = [
      '[project]',
      'dependencies = [',
      '  # Pinned to the packaged core.',
      '  "demo-core~=7.0",',
      '  "requests~=2.30",',
      ']',
      '',
      '[project.optional-dependencies]',
      'test = [ "demo-test~=7.0" ]',
      '',
      '[dependency-groups]',
      'docs = [ "demo-docs~=7.0" ]',
      '',
    ].join('\n');

    const { changed, count, result } = replaceStringLiterals(source, [
      { from: 'demo-core~=7.0', to: 'demo-core~=8.0' },
      { from: 'demo-test~=7.0', to: 'demo-test~=8.0' },
      { from: 'demo-docs~=7.0', to: 'demo-docs~=8.0' },
    ]);

    expect(changed).toBe(true);
    expect(count).toBe(3);
    expect(result).toContain('# Pinned to the packaged core.');
    expect(result).toContain('"demo-core~=8.0"');
    expect(result).toContain('"demo-test~=8.0"');
    expect(result).toContain('"demo-docs~=8.0"');
    expect(result).toContain('"requests~=2.30"');
  });

  it('preserves the quote style of each literal', () => {
    const source = `dependencies = [ 'demo~=7.0', "other~=7.0" ]`;

    const { result } = replaceStringLiterals(source, [
      { from: 'demo~=7.0', to: 'demo~=8.0' },
      { from: 'other~=7.0', to: 'other~=8.0' },
    ]);

    expect(result).toBe(`dependencies = [ 'demo~=8.0', "other~=8.0" ]`);
  });

  it('matches whole literals, never a prefix of a longer specifier', () => {
    const source = 'dependencies = [ "demo~=7.0", "demo-extra~=7.0" ]';

    const { count, result } = replaceStringLiterals(source, [
      { from: 'demo~=7.0', to: 'demo~=8.0' },
    ]);

    expect(count).toBe(1);
    expect(result).toBe('dependencies = [ "demo~=8.0", "demo-extra~=7.0" ]');
  });

  it('is a no-op when nothing differs', () => {
    const source = 'dependencies = [ "demo~=7.0" ]';

    expect(
      replaceStringLiterals(source, [{ from: 'demo~=7.0', to: 'demo~=7.0' }]),
    ).toEqual({ changed: false, result: source, count: 0 });
  });

  it('escapes regular-expression metacharacters in a specifier', () => {
    const source = 'dependencies = [ "demo[extra]~=7.0" ]';

    const { changed, result } = replaceStringLiterals(source, [
      { from: 'demo[extra]~=7.0', to: 'demo[extra]~=8.0' },
    ]);

    expect(changed).toBe(true);
    expect(result).toBe('dependencies = [ "demo[extra]~=8.0" ]');
  });
});
