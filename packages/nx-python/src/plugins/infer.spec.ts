import dedent from 'string-dedent';
import type Parser from 'web-tree-sitter';
import { extractImportedModules, getPythonParser } from './infer';

describe('infer', () => {
  let parser: Parser;

  beforeAll(async () => {
    parser = await getPythonParser();
  });

  describe('getPythonParser', () => {
    it('should return the same cached parser instance', async () => {
      const first = await getPythonParser();
      const second = await getPythonParser();

      expect(first).toBe(second);
    });
  });

  describe('extractImportedModules', () => {
    it('should extract a simple import', () => {
      expect(extractImportedModules(parser, 'import foo')).toStrictEqual([
        'foo',
      ]);
    });

    it('should return the top-level module for dotted imports', () => {
      expect(
        extractImportedModules(parser, 'import foo.bar.baz'),
      ).toStrictEqual(['foo']);
    });

    it('should extract the module of a `from ... import ...` statement', () => {
      expect(
        extractImportedModules(parser, 'from foo.bar import baz'),
      ).toStrictEqual(['foo']);
    });

    it('should unwrap aliased imports', () => {
      expect(
        extractImportedModules(parser, 'import foo.bar as qux'),
      ).toStrictEqual(['foo']);
    });

    it('should extract every module of a multi-import statement', () => {
      expect(
        extractImportedModules(parser, 'import foo, bar.baz as qux, quux'),
      ).toStrictEqual(['foo', 'bar', 'quux']);
    });

    it('should ignore relative imports', () => {
      const content = dedent`
        from . import sibling
        from .module import thing
        from ..package import other
      `;

      expect(extractImportedModules(parser, content)).toStrictEqual([]);
    });

    it('should ignore import-looking text in comments and strings', () => {
      const content = dedent`
        # import commented
        example = "import quoted"
        another = 'from quoted import thing'
      `;

      expect(extractImportedModules(parser, content)).toStrictEqual([]);
    });

    it('should detect imports nested inside functions and blocks', () => {
      const content = dedent`
        def handler():
            import nested

        try:
            from deferred.module import thing
        except ImportError:
            pass
      `;

      expect(extractImportedModules(parser, content)).toStrictEqual([
        'nested',
        'deferred',
      ]);
    });

    it('should preserve source order and keep duplicates', () => {
      const content = dedent`
        import first
        from second.sub import x
        import first
      `;

      expect(extractImportedModules(parser, content)).toStrictEqual([
        'first',
        'second',
        'first',
      ]);
    });

    it('should return an empty array for files without imports', () => {
      const content = dedent`
        def add(a, b):
            return a + b
      `;

      expect(extractImportedModules(parser, content)).toStrictEqual([]);
    });
  });
});
