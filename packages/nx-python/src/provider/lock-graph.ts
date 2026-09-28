import { ProjectGraphExternalNode } from '@nx/devkit';
import { createHash } from 'node:crypto';
import type { LockGraph } from './base';

/** A package a lock file pins, in the shape both lock readers produce. */
export type LockedPackage = {
  name: string;
  version: string;
  source?: Record<string, unknown>;
  artifactHashes: string[];
};

/** A workspace member and every locked package it installs. */
export type LockedMember = {
  root: string;
  lockFile: string;
  installs: LockedPackage[];
};

/**
 * Turns what the lock readers found into the plugin's {@link LockGraph}: one
 * `pypi` external node per distinct locked package, named by as much of name,
 * version and source as it takes to tell the copies of a name apart, since a
 * lock can pin one name at several versions and one version from several
 * sources.
 */
export function buildLockGraph(
  packages: LockedPackage[],
  members: LockedMember[],
): LockGraph {
  const distinct = new Map<string, LockedPackage>();
  for (const pkg of packages) {
    distinct.set(packageIdentity(pkg), pkg);
  }
  const copiesByName = new Map<string, LockedPackage[]>();
  for (const pkg of distinct.values()) {
    copiesByName.set(pkg.name, [...(copiesByName.get(pkg.name) ?? []), pkg]);
  }
  const nodeName = (pkg: LockedPackage) =>
    externalNodeName(pkg, copiesByName.get(pkg.name));

  const externalNodes: Record<string, ProjectGraphExternalNode> = {};
  for (const pkg of distinct.values()) {
    const name = nodeName(pkg);
    externalNodes[name] = {
      type: 'pypi',
      name,
      data: {
        version: pkg.version,
        packageName: pkg.name,
        hash: sha256(
          JSON.stringify([
            pkg.version,
            sourceKey(pkg.source),
            pkg.artifactHashes,
          ]),
        ),
      },
    };
  }

  const graphMembers: LockGraph['members'] = {};
  for (const member of members) {
    graphMembers[member.root] = {
      lockFile: member.lockFile,
      dependencies: [...new Set(member.installs.map(nodeName))].sort(byText),
    };
  }
  return { externalNodes, members: graphMembers };
}

function externalNodeName(pkg: LockedPackage, copies: LockedPackage[]): string {
  if (copies.length === 1) {
    return `pypi:${pkg.name}`;
  }
  const sameVersion = copies.filter((copy) => copy.version === pkg.version);
  if (sameVersion.length === 1) {
    return `pypi:${pkg.name}@${pkg.version}`;
  }
  const source = sha256(sourceKey(pkg.source)).slice(0, 8);
  return `pypi:${pkg.name}@${pkg.version}#${source}`;
}

/**
 * Everything reachable from `starts`, visiting each distinct item once, where
 * `next` gives an item's successors and `key` its identity.
 */
export function walk<T>(
  starts: T[],
  next: (item: T) => T[],
  key: (item: T) => string,
): T[] {
  const seen = new Map<string, T>();
  const queue = [...starts];
  while (queue.length) {
    const item = queue.pop();
    const id = key(item);
    if (!seen.has(id)) {
      seen.set(id, item);
      queue.push(...next(item));
    }
  }
  return [...seen.values()];
}

/** A package's identity: its name, version and source. */
export function packageIdentity(pkg: {
  name: string;
  version?: string;
  source?: Record<string, unknown>;
}): string {
  return JSON.stringify([pkg.name, pkg.version, sourceKey(pkg.source)]);
}

/** A source table as text that does not depend on key order. */
export function sourceKey(source: Record<string, unknown> = {}): string {
  return JSON.stringify(
    Object.keys(source)
      .sort(byText)
      .map((key) => [key, source[key]]),
  );
}

/** A path without leading `./` and trailing `/`, and `.` for the root. */
export function normalizeRoot(path: string): string {
  let root = path.startsWith('./') ? path.slice(2) : path;
  while (root.endsWith('/')) {
    root = root.slice(0, -1);
  }
  return root === '' || root === '.' ? '.' : root;
}

/** The PEP 503 form of a package name, as lock files record it. */
export function normalizePackageName(name: string): string {
  return name.toLowerCase().replace(/[-_.]+/g, '-');
}

function byText(a: string, b: string): number {
  return a.localeCompare(b);
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
