import toml from '@iarna/toml';
import { posix } from 'node:path';
import type { LockGraph } from '../base';
import {
  buildLockGraph,
  LockedPackage,
  normalizeRoot,
  packageIdentity,
  sourceKey,
  walk,
} from '../lock-graph';

type UvDependency = {
  name: string;
  version?: string;
  source?: Record<string, string>;
  extra?: string[];
};

type UvPackage = {
  name: string;
  version?: string;
  source?: Record<string, string>;
  dependencies?: UvDependency[];
  'optional-dependencies'?: Record<string, UvDependency[]>;
  'dev-dependencies'?: Record<string, UvDependency[]>;
  sdist?: { hash?: string };
  wheels?: { hash?: string }[];
};

// A package reached through its own dependencies (`extra` null), one of its
// extras, or one of a member's dependency groups (`group:<name>`).
type Visit = { pkg: UvPackage; extra: string | null };

export type UvLockFile = { path: string; text: string };

/**
 * Reads the uv lock files of a workspace: every locked package, and for each
 * member the packages it installs through its dependencies, its extras and
 * dependency groups, the extras those ask for, and other members.
 *
 * - In a shared workspace (`shared`), the root `uv.lock` lists every member.
 * - Otherwise each project locks on its own, and its `uv.lock` also lists the
 *   local projects it depends on; only the project the lock belongs to is
 *   read from it, since the others have their own locks.
 */
export function getUvLockGraph(
  lockFiles: UvLockFile[],
  shared: boolean,
): LockGraph {
  const locks = lockFiles.map(({ path, text }) =>
    readUvLock(path, (toml.parse(text).package ?? []) as UvPackage[], shared),
  );
  return buildLockGraph(
    locks.flatMap((lock) => lock.packages),
    locks.flatMap((lock) => lock.members),
  );
}

function readUvLock(lockFile: string, packages: UvPackage[], shared: boolean) {
  const byName = new Map<string, UvPackage[]>();
  for (const pkg of packages) {
    byName.set(pkg.name, [...(byName.get(pkg.name) ?? []), pkg]);
  }
  const lockDir = posix.dirname(lockFile);
  const rootOf = (member: UvPackage) =>
    normalizeRoot(
      posix.join(lockDir, member.source.editable ?? member.source.virtual),
    );

  const members = packages
    .filter(isMember)
    .filter((member) => shared || rootOf(member) === normalizeRoot(lockDir))
    .map((member) => ({
      root: rootOf(member),
      lockFile,
      installs: walk(memberVisits(member), (visit) => next(visit, byName), key)
        .map((visit) => visit.pkg)
        .filter((pkg) => !isMember(pkg))
        .map(toLockedPackage),
    }));

  return {
    packages: packages.filter((pkg) => !isMember(pkg)).map(toLockedPackage),
    members,
  };
}

function isMember(pkg: UvPackage): boolean {
  return (
    pkg.source?.editable !== undefined || pkg.source?.virtual !== undefined
  );
}

function memberVisits(member: UvPackage): Visit[] {
  return [
    { pkg: member, extra: null },
    ...Object.keys(member['optional-dependencies'] ?? {}).map((extra) => ({
      pkg: member,
      extra,
    })),
    ...Object.keys(member['dev-dependencies'] ?? {}).map((group) => ({
      pkg: member,
      extra: `group:${group}`,
    })),
  ];
}

function edges({ pkg, extra }: Visit): UvDependency[] {
  if (extra === null) {
    return pkg.dependencies ?? [];
  }
  if (extra.startsWith('group:')) {
    return pkg['dev-dependencies']?.[extra.slice('group:'.length)] ?? [];
  }
  return pkg['optional-dependencies']?.[extra] ?? [];
}

function next(visit: Visit, byName: Map<string, UvPackage[]>): Visit[] {
  return edges(visit).flatMap((dep) =>
    (byName.get(dep.name) ?? [])
      .filter((target) => matches(dep, target))
      .flatMap((pkg) => [
        { pkg, extra: null },
        ...(dep.extra ?? []).map((extra) => ({ pkg, extra })),
      ]),
  );
}

// An edge to a name with several copies names the version and source it means.
function matches(dep: UvDependency, target: UvPackage): boolean {
  if (dep.version && target.version !== dep.version) {
    return false;
  }
  return !dep.source || sourceKey(dep.source) === sourceKey(target.source);
}

function key({ pkg, extra }: Visit): string {
  return `${packageIdentity(pkg)}#${extra ?? ''}`;
}

function toLockedPackage(pkg: UvPackage): LockedPackage {
  return {
    name: pkg.name,
    version: pkg.version ?? '',
    source: pkg.source,
    artifactHashes: [
      pkg.sdist?.hash,
      ...(pkg.wheels ?? []).map((wheel) => wheel.hash),
    ].filter(Boolean),
  };
}
