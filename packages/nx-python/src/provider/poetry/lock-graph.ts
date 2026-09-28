import toml from '@iarna/toml';
import { posix } from 'node:path';
import type { LockGraph } from '../base';
import {
  buildLockGraph,
  LockedMember,
  LockedPackage,
  normalizePackageName,
  normalizeRoot,
  packageIdentity,
  walk,
} from '../lock-graph';

type PoetryConstraint = string | { extras?: string[] };

type PoetryPackage = {
  name: string;
  version: string;
  files?: { hash?: string }[];
  source?: { type?: string; url?: string; reference?: string };
  dependencies?: Record<string, PoetryConstraint | PoetryConstraint[]>;
  extras?: Record<string, string[]>;
};

type Visit = { pkg: PoetryPackage; extra: string | null };

export type PoetryLockFile = { path: string; text: string };

/**
 * Reads the Poetry lock files of a workspace.
 *
 * - In a shared workspace (`shared`), the root `poetry.lock` records each
 *   member as a `directory` package with its dependencies, so a member
 *   installs what its entry reaches: those dependencies, the extras they ask
 *   for, and other members.
 * - Otherwise each project locks on its own, and everything its
 *   `poetry.lock` pins is what that project installs.
 */
export function getPoetryLockGraph(
  lockFiles: PoetryLockFile[],
  shared: boolean,
): LockGraph {
  const parsed = lockFiles.map(({ path, text }) => ({
    path,
    packages: (toml.parse(text).package ?? []) as PoetryPackage[],
  }));
  const members = parsed.flatMap(({ path, packages }) =>
    shared ? sharedMembers(path, packages) : [projectMember(path, packages)],
  );
  const packages = parsed.flatMap(({ packages }) =>
    packages.filter((pkg) => !isLocal(pkg)).map(toLockedPackage),
  );
  return buildLockGraph(packages, members);
}

function projectMember(
  lockFile: string,
  packages: PoetryPackage[],
): LockedMember {
  return {
    root: normalizeRoot(posix.dirname(lockFile)),
    lockFile,
    installs: packages.filter((pkg) => !isLocal(pkg)).map(toLockedPackage),
  };
}

function sharedMembers(
  lockFile: string,
  packages: PoetryPackage[],
): LockedMember[] {
  const byName = new Map<string, PoetryPackage[]>();
  for (const pkg of packages) {
    const name = normalizePackageName(pkg.name);
    byName.set(name, [...(byName.get(name) ?? []), pkg]);
  }
  const lockDir = posix.dirname(lockFile);
  return packages.filter(isDirectory).map((member) => ({
    root: normalizeRoot(posix.join(lockDir, member.source.url)),
    lockFile,
    installs: walk(
      [{ pkg: member, extra: null }],
      (visit) => next(visit, byName),
      key,
    )
      .map((visit) => visit.pkg)
      .filter((pkg) => !isLocal(pkg))
      .map(toLockedPackage),
  }));
}

function next(visit: Visit, byName: Map<string, PoetryPackage[]>): Visit[] {
  return requirements(visit).flatMap(({ name, extras }) =>
    (byName.get(normalizePackageName(name)) ?? []).flatMap((pkg) => [
      { pkg, extra: null },
      ...extras.map((extra) => ({ pkg, extra })),
    ]),
  );
}

// A package's own dependencies, or the requirement strings of one of its
// extras, such as "PySocks (>=1.5.6,!=1.5.7)".
function requirements({
  pkg,
  extra,
}: Visit): { name: string; extras: string[] }[] {
  if (extra !== null) {
    return (pkg.extras?.[extra] ?? []).map((requirement) => ({
      name: /^[A-Za-z0-9._-]+/.exec(requirement)?.[0] ?? requirement,
      extras: [],
    }));
  }
  return Object.entries(pkg.dependencies ?? {}).map(([name, constraint]) => ({
    name,
    extras: [constraint]
      .flat()
      .flatMap((entry) =>
        typeof entry === 'string' ? [] : (entry.extras ?? []),
      ),
  }));
}

function key({ pkg, extra }: Visit): string {
  return `${packageIdentity(pkg)}#${extra ?? ''}`;
}

// Directory packages are workspace projects, which Nx already knows.
function isLocal(pkg: PoetryPackage): boolean {
  return pkg.source?.type === 'directory';
}

function isDirectory(pkg: PoetryPackage): boolean {
  return isLocal(pkg) && pkg.source.url !== undefined;
}

function toLockedPackage(pkg: PoetryPackage): LockedPackage {
  return {
    name: normalizePackageName(pkg.name),
    version: pkg.version,
    source: pkg.source,
    artifactHashes: (pkg.files ?? []).map((file) => file.hash).filter(Boolean),
  };
}
