import { satisfies } from '@renovatebot/pep440';

/**
 * PEP 440 comparison operators that should have their version bumped to the
 * newly released version. Setting any of these to the released version keeps
 * the specifier satisfiable by that version:
 * - `==` / `===` exact pins
 * - `~=` compatible release
 * - `>=` inclusive lower bound
 *
 * The remaining operators (`>`, `<`, `<=`, `!=`) are intentionally left
 * untouched: bumping a `<`/`<=` ceiling would track the release version (which
 * is rarely intended), and bumping `>`/`!=` to the released version would
 * exclude it. Any of those that end up excluding the released version are
 * caught by the satisfiability check below.
 */
const UPDATABLE_OPERATORS = new Set(['==', '===', '~=', '>=']);

// Recognized PEP 440 operators, longest first so the regex matches greedily.
const CLAUSE_REGEX = /^(===|==|~=|!=|>=|<=|>|<)\s*(.+)$/;

// Leading package name + optional extras (e.g. `lib1[color]`) followed by the
// rest of the requirement (the version specifier).
const REQUIREMENT_REGEX = /^\s*([A-Za-z0-9._-]+)\s*(\[[^\]]*\])?\s*(.*)$/;

export interface RewriteSpecifierResult {
  /** Whether the dependency string was modified. */
  changed: boolean;
  /** The resulting dependency string (unchanged when `changed` is false). */
  result: string;
}

/**
 * Normalizes a package name for comparison following PEP 503: lower-cased with
 * runs of `.`, `-` and `_` collapsed to a single `-`.
 */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[-_.]+/g, '-');
}

/**
 * Truncates (or zero-pads) a version to a given number of release components,
 * preserving the precision originally used in the specifier.
 *
 * truncateVersion('1.4.0', 2) -> '1.4'
 * truncateVersion('1.4', 3)   -> '1.4.0'
 */
function truncateVersion(version: string, precision: number): string {
  const parts = version.split('.');
  const result: string[] = [];
  for (let i = 0; i < precision; i++) {
    result.push(parts[i] ?? '0');
  }
  return result.join('.');
}

/**
 * Rewrites the version specifier of a single PEP 508 dependency string so that
 * it references `newVersion`, when the dependency matches `packageName`.
 *
 * Behavior:
 * - Bumps the version of `==`, `===`, `~=` and `>=` clauses to `newVersion`,
 *   preserving the operator and the original component precision. Trailing `.*`
 *   prefix-match wildcards are preserved (e.g. `==1.1.*` becomes `==1.4.*`).
 * - Leaves `>`, `<`, `<=`, `!=` clauses untouched.
 * - Leaves dependencies with no version specifier untouched (the build step
 *   pins those automatically in publish mode).
 * - Throws when the resulting specifier no longer allows `newVersion` (e.g. a
 *   `<` ceiling below the release), so the developer can fix the constraint.
 *
 * @param dependency - The original dependency string (e.g. `lib1~=1.1`).
 * @param packageName - The package name being released.
 * @param newVersion - The newly released version (e.g. `1.4.0`).
 */
export function rewriteDependencySpecifier(
  dependency: string,
  packageName: string,
  newVersion: string,
): RewriteSpecifierResult {
  const unchanged: RewriteSpecifierResult = {
    changed: false,
    result: dependency,
  };

  // Separate the environment marker (everything from the first `;`) so it is
  // preserved verbatim and not parsed as part of the version specifier.
  const semicolonIndex = dependency.indexOf(';');
  const marker = semicolonIndex >= 0 ? dependency.slice(semicolonIndex) : '';
  const requirement =
    semicolonIndex >= 0 ? dependency.slice(0, semicolonIndex) : dependency;

  const match = REQUIREMENT_REGEX.exec(requirement);
  if (!match) {
    return unchanged;
  }

  const [, name, extras = '', specifierStr] = match;
  if (normalizeName(name) !== normalizeName(packageName)) {
    return unchanged;
  }

  const trimmedSpecifier = specifierStr.trim();
  if (!trimmedSpecifier) {
    // No version specifier; the build step pins this dependency automatically.
    return unchanged;
  }

  let changed = false;
  const rewrittenClauses = trimmedSpecifier.split(',').map((rawClause) => {
    const clause = rawClause.trim();
    const clauseMatch = CLAUSE_REGEX.exec(clause);
    if (!clauseMatch) {
      return clause;
    }

    const [, operator, rawVersion] = clauseMatch;
    const version = rawVersion.trim();
    if (!UPDATABLE_OPERATORS.has(operator)) {
      // Keep the operator but normalize whitespace (e.g. `< 2.0` -> `<2.0`).
      return `${operator}${version}`;
    }

    // Preserve a trailing `.*` prefix-match wildcard (e.g. `==1.1.*` becomes
    // `==1.4.*`) so the original "track this series" intent is kept.
    const hasWildcard = version.endsWith('.*');
    const numericVersion = hasWildcard ? version.slice(0, -2) : version;
    const precision = numericVersion.split('.').length;
    const rewritten = `${operator}${truncateVersion(newVersion, precision)}${
      hasWildcard ? '.*' : ''
    }`;
    if (rewritten !== clause) {
      changed = true;
    }
    return rewritten;
  });

  const rewrittenSpecifier = rewrittenClauses.join(',');

  // Validate that the released version is actually allowed by the resulting
  // specifier. This catches kept ceilings/exclusions that would exclude the
  // release (e.g. `>=1.0,<1.3` when releasing 1.4.0).
  if (!satisfies(newVersion, rewrittenSpecifier)) {
    throw new Error(
      `Cannot update dependency "${packageName}" to version ${newVersion}: ` +
        `the version constraint "${name}${extras}${rewrittenSpecifier}" does not allow ${newVersion}. ` +
        `Please fix the version constraint for "${packageName}" in the manifest.`,
    );
  }

  if (!changed) {
    return unchanged;
  }

  return {
    changed: true,
    result: `${name}${extras}${rewrittenSpecifier}${
      marker ? ` ${marker.trim()}` : ''
    }`,
  };
}
