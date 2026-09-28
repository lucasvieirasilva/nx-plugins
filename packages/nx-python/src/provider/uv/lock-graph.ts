import { ProjectGraphExternalNode } from '@nx/devkit';
import toml from '@iarna/toml';
import { createHash } from 'node:crypto';
import type { LockGraph } from '../base';

type LockedDependency = {
  name: string;
  version?: string;
  source?: Record<string, string>;
  extra?: string[];
};

type LockedPackage = {
  name: string;
  version?: string;
  source?: Record<string, string>;
  dependencies?: LockedDependency[];
  'optional-dependencies'?: Record<string, LockedDependency[]>;
  'dev-dependencies'?: Record<string, LockedDependency[]>;
  sdist?: { hash?: string };
  wheels?: { hash?: string }[];
};

/**
 * Reads a workspace `uv.lock` into one `pypi` external node per locked package,
 * plus the nodes each workspace member installs: its dependencies, its extras
 * and dependency groups, the extras those ask for, and the same through any
 * other member it depends on.
 */
export function getUvLockGraph(
  lockText: string,
  lockFile = 'uv.lock',
): LockGraph {
  const packages = (toml.parse(lockText).package ?? []) as LockedPackage[];
  const byName = new Map<string, LockedPackage[]>();
  for (const pkg of packages) {
    byName.set(pkg.name, [...(byName.get(pkg.name) ?? []), pkg]);
  }

  const isMember = (pkg: LockedPackage) =>
    pkg.source?.editable !== undefined || pkg.source?.virtual !== undefined;
  // uv can lock one name at several versions (per-platform forks), and even
  // one version from several sources, so a node is named by as much of
  // name, version and source as it takes to tell the copies apart.
  const nodeName = (pkg: LockedPackage) => {
    const copies = byName.get(pkg.name);
    if (copies.length === 1) {
      return `pypi:${pkg.name}`;
    }
    const sameVersion = copies.filter((copy) => copy.version === pkg.version);
    return sameVersion.length === 1
      ? `pypi:${pkg.name}@${pkg.version}`
      : `pypi:${pkg.name}@${pkg.version}#${hash(sourceKey(pkg.source)).slice(0, 8)}`;
  };

  const externalNodes: Record<string, ProjectGraphExternalNode> = {};
  for (const pkg of packages) {
    if (isMember(pkg)) {
      continue;
    }
    externalNodes[nodeName(pkg)] = {
      type: 'pypi',
      name: nodeName(pkg),
      data: {
        version: pkg.version ?? '',
        packageName: pkg.name,
        hash: hashPackage(pkg),
      },
    };
  }

  // A null extra is the package's own dependencies; `group:<name>` is one of a
  // member's dependency groups.
  const edges = (pkg: LockedPackage, extra: string | null) =>
    extra === null
      ? (pkg.dependencies ?? [])
      : extra.startsWith('group:')
        ? (pkg['dev-dependencies']?.[extra.slice('group:'.length)] ?? [])
        : (pkg['optional-dependencies']?.[extra] ?? []);

  const memberDependencies: Record<string, string[]> = {};
  for (const member of packages) {
    if (!isMember(member)) {
      continue;
    }
    const queue: [LockedPackage, string | null][] = [
      [member, null],
      ...Object.keys(member['optional-dependencies'] ?? {}).map(
        (extra): [LockedPackage, string] => [member, extra],
      ),
      ...Object.keys(member['dev-dependencies'] ?? {}).map(
        (group): [LockedPackage, string] => [member, `group:${group}`],
      ),
    ];
    const walked = new Set<string>();
    const installed = new Set<string>();
    while (queue.length) {
      const [pkg, extra] = queue.pop();
      const key = `${identity(pkg)}#${extra ?? ''}`;
      if (walked.has(key)) {
        continue;
      }
      walked.add(key);
      if (!isMember(pkg)) {
        installed.add(nodeName(pkg));
      }
      for (const dep of edges(pkg, extra)) {
        for (const target of byName.get(dep.name) ?? []) {
          // An edge to a name with several copies names the version and
          // source it means.
          if (dep.version && target.version !== dep.version) {
            continue;
          }
          if (
            dep.source &&
            sourceKey(dep.source) !== sourceKey(target.source)
          ) {
            continue;
          }
          queue.push([target, null]);
          for (const name of dep.extra ?? []) {
            queue.push([target, name]);
          }
        }
      }
    }
    memberDependencies[memberRoot(member)] = [...installed].sort();
  }

  return { externalNodes, memberDependencies, lockFile };
}

function sourceKey(source: Record<string, string> = {}): string {
  return JSON.stringify(
    Object.keys(source)
      .sort()
      .map((key) => [key, source[key]]),
  );
}

function identity(pkg: LockedPackage): string {
  return JSON.stringify([pkg.name, pkg.version, sourceKey(pkg.source)]);
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function memberRoot(pkg: LockedPackage): string {
  const root = (pkg.source.editable ?? pkg.source.virtual)
    .replace(/^\.\/?/, '')
    .replace(/\/+$/, '');
  return root || '.';
}

function hashPackage(pkg: LockedPackage): string {
  return hash(
    JSON.stringify([
      pkg.version,
      sourceKey(pkg.source),
      pkg.sdist?.hash,
      (pkg.wheels ?? []).map((wheel) => wheel.hash),
    ]),
  );
}
