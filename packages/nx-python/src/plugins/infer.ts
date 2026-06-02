import Parser from 'web-tree-sitter';

let pythonParserPromise: Promise<Parser> | undefined;

/**
 * Lazily create (and cache) a tree-sitter parser configured for Python.
 *
 * The grammar is loaded from the prebuilt WebAssembly binary shipped by
 * `tree-sitter-wasms`, which avoids the native-build issues that the
 * `tree-sitter` Node bindings have on newer Node.js versions while still
 * giving us a proper parser instead of a regular expression.
 *
 * The native bindings fail to build on Node.js 24, see
 * https://github.com/tree-sitter/node-tree-sitter/issues/268
 */
export function getPythonParser(): Promise<Parser> {
  if (!pythonParserPromise) {
    pythonParserPromise = (async () => {
      await Parser.init();
      const language = await Parser.Language.load(
        require.resolve('tree-sitter-wasms/out/tree-sitter-python.wasm'),
      );
      const parser = new Parser();
      parser.setLanguage(language);
      return parser;
    })();
  }
  return pythonParserPromise;
}

/**
 * Resolve the first `dotted_name` node within an import child, unwrapping
 * `aliased_import` nodes (`import foo.bar as baz`) when needed.
 */
function getDottedName(node: Parser.SyntaxNode): Parser.SyntaxNode | undefined {
  if (node.type === 'dotted_name') {
    return node;
  }
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i);
    if (child?.type === 'dotted_name') {
      return child;
    }
  }
  return undefined;
}

/**
 * Return the top-level module name of a `dotted_name` node (the first
 * identifier), e.g. `foo` for both `foo` and `foo.bar.baz`.
 */
function getTopLevelModule(dottedName: Parser.SyntaxNode): string | undefined {
  for (let i = 0; i < dottedName.namedChildCount; i++) {
    const child = dottedName.namedChild(i);
    if (child?.type === 'identifier') {
      return child.text;
    }
  }
  return undefined;
}

/**
 * Parse a Python source file with tree-sitter and return the top-level module
 * name of every import, in source order.
 *
 * - `import foo.bar` and `from foo.bar import baz` both yield `foo`.
 * - `import foo, bar` yields both `foo` and `bar`.
 * - Relative imports (`from . import x`) are ignored since they can never
 *   reference another local project.
 */
export function extractImportedModules(
  parser: Parser,
  content: string,
): string[] {
  const tree = parser.parse(content);
  const modules: string[] = [];

  for (const node of tree.rootNode.descendantsOfType([
    'import_statement',
    'import_from_statement',
  ])) {
    if (node.type === 'import_from_statement') {
      const moduleName = node.childForFieldName('module_name');
      // `relative_import` nodes (e.g. `from . import x`) are skipped.
      if (moduleName?.type === 'dotted_name') {
        const module = getTopLevelModule(moduleName);
        if (module) {
          modules.push(module);
        }
      }
      continue;
    }

    // `import_statement` can hold several `dotted_name` / `aliased_import`
    // children (e.g. `import foo, bar.baz as qux`).
    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i);
      if (!child) {
        continue;
      }
      const dottedName = getDottedName(child);
      if (dottedName) {
        const module = getTopLevelModule(dottedName);
        if (module) {
          modules.push(module);
        }
      }
    }
  }

  return modules;
}
