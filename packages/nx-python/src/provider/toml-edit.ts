/**
 * Source-preserving edits for `pyproject.toml`.
 *
 * `@iarna/toml` models a document as a plain object, so stringifying one back
 * rebuilds the file from scratch: every comment, blank line and formatting
 * choice the author made is dropped. A release only ever rewrites a version
 * string or a dependency specifier, so those edits are applied to the original
 * source text instead, leaving the rest of the document byte-for-byte intact.
 *
 * Every helper reports whether it matched, so callers can fall back to the
 * object round-trip for documents these targeted edits do not cover.
 */

export interface TomlEditResult {
  /** Whether the edit matched and was applied. */
  changed: boolean;
  /** The edited document, or the original source when nothing matched. */
  result: string;
}

/** A `[table]` or `[table.sub]` header, tolerating indentation and a trailing comment. */
const TABLE_HEADER = /^[ \t]*\[([^[\]]+)\][ \t]*(?:#.*)?$/;

/**
 * Locate the lines belonging directly to `tablePath`, exclusive of any sub-table.
 *
 * A table runs from its header to the next header of any kind, which is what
 * makes the range exclusive: keys written after `[project.urls]` belong to that
 * sub-table, not to `[project]`.
 */
function findTableRange(
  lines: string[],
  tablePath: string,
): [number, number] | null {
  let start = -1;

  for (let i = 0; i < lines.length; i++) {
    const match = TABLE_HEADER.exec(lines[i]);
    if (!match) {
      continue;
    }
    if (start !== -1) {
      return [start, i];
    }
    if (match[1].trim() === tablePath) {
      start = i + 1;
    }
  }

  return start === -1 ? null : [start, lines.length];
}

/** Escape a literal for embedding in a regular expression. */
function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replace the value of a quoted string key inside a specific table.
 *
 * Only the quoted value is rewritten, so an inline trailing comment on the same
 * line survives. Returns `changed: false` when the table or the key is absent,
 * which leaves the caller free to fall back rather than guess where to insert.
 */
export function setTableStringValue(
  source: string,
  tablePath: string,
  key: string,
  value: string,
): TomlEditResult {
  const lines = source.split('\n');
  const range = findTableRange(lines, tablePath);
  if (!range) {
    return { changed: false, result: source };
  }

  const [start, end] = range;
  const assignment = new RegExp(
    `^([ \\t]*${escapeRegExp(key)}[ \\t]*=[ \\t]*)(["'])(?:[^"'\\\\]|\\\\.)*\\2(.*)$`,
  );

  for (let i = start; i < end; i++) {
    const match = assignment.exec(lines[i]);
    if (!match) {
      continue;
    }
    lines[i] = `${match[1]}"${value}"${match[3]}`;
    return { changed: true, result: lines.join('\n') };
  }

  return { changed: false, result: source };
}

export interface StringLiteralReplacement {
  from: string;
  to: string;
}

export interface ReplaceLiteralsResult extends TomlEditResult {
  /** How many literals were rewritten. */
  count: number;
}

/**
 * Rewrite whole quoted string literals, preserving each one's quote style.
 *
 * Used for dependency specifiers, which are distinctive enough (`bsb-core~=7.0`)
 * that matching the complete quoted token is unambiguous. Matching the complete
 * token also means a specifier can never be rewritten into a partial match of a
 * longer one.
 */
export function replaceStringLiterals(
  source: string,
  replacements: StringLiteralReplacement[],
): ReplaceLiteralsResult {
  let result = source;
  let count = 0;

  for (const { from, to } of replacements) {
    if (from === to) {
      continue;
    }
    const literal = new RegExp(`(["'])${escapeRegExp(from)}\\1`, 'g');
    result = result.replace(literal, (match, quote: string) => {
      count++;
      return `${quote}${to}${quote}`;
    });
  }

  return { changed: count > 0, result, count };
}
