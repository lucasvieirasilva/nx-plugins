/**
 * This script starts a local registry for e2e testing purposes.
 * It is meant to be used as Vitest's `globalSetup`: the returned function is
 * invoked once, after all e2e tests finish, to tear the registry down.
 */

import { workspaceRoot } from '@nx/devkit';
import { startLocalRegistry } from '@nx/js/plugins/jest/local-registry';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { releasePublish, releaseVersion } from 'nx/release';

/**
 * Environment variable carrying the `@nxlv/python` version published for this
 * run, read by the specs' workspace harness. Vitest forks its workers after
 * globalSetup, so a variable set here reaches them.
 */
export const E2E_VERSION_ENV = 'NXLV_PYTHON_E2E_VERSION';

/**
 * Captures every workspace package manifest so the throwaway e2e version that
 * `releaseVersion` writes into them can be undone once it has been published.
 */
function snapshotManifests(): Map<string, string> {
  const packagesDir = join(workspaceRoot, 'packages');
  const snapshot = new Map<string, string>();
  for (const dir of readdirSync(packagesDir)) {
    const manifest = join(packagesDir, dir, 'package.json');
    if (existsSync(manifest)) {
      snapshot.set(manifest, readFileSync(manifest, 'utf-8'));
    }
  }
  return snapshot;
}

function restoreManifests(snapshot: Map<string, string>): void {
  for (const [manifest, content] of snapshot) {
    if (readFileSync(manifest, 'utf-8') !== content) {
      writeFileSync(manifest, content);
    }
  }
}

export default async () => {
  // local registry target to run
  const localRegistryTarget = '@nxlv/nx-plugins:local-registry';
  // storage folder for the local registry
  const storage = './tmp/local-registry/storage';

  const stopLocalRegistry = await startLocalRegistry({
    localRegistryTarget,
    storage,
    verbose: false,
  });

  // `startLocalRegistry` only overrides the *default* registry, and only for
  // npm/yarn/bun. Two things still escape to real npm otherwise:
  //   1. pnpm (used by nx-release-publish and the scratch workspace) doesn't
  //      pick up that default, so we set `npm_config_registry` which it honors.
  //   2. A scoped `@nxlv:registry=https://registry.npmjs.org/` line in the
  //      user's ~/.npmrc pins the @nxlv scope to real npm; the scoped key must
  //      be overridden explicitly (env vars take precedence over ~/.npmrc).
  const registry = 'http://localhost:4873';
  process.env.npm_config_registry = registry;
  process.env['npm_config_@nxlv:registry'] = registry;
  // verdaccio allows anonymous publish, but pnpm still expects an auth token
  // to be present for the target registry before it will publish.
  process.env['npm_config_//localhost:4873/:_authToken'] = 'e2e-fake-token';

  // A unique version per run, recorded for the specs to install by exact
  // version. Republishing a fixed version (e.g. `0.0.0-e2e`) looks like it
  // works — the publish succeeds — but the scratch workspace then silently
  // installs a STALE tarball, because pnpm keys its content-addressed store by
  // name@version and caches the registry metadata behind the `e2e` dist-tag.
  // Every code change since the first publish is invisible to the e2e, which
  // passes or fails against code that is not the one under test.
  const e2eVersion = `0.0.0-e2e-${Date.now()}`;
  process.env[E2E_VERSION_ENV] = e2eVersion;

  // `releaseVersion` writes the e2e version into the packages' package.json
  // files. The specs only need the published tarballs (they read the version
  // from E2E_VERSION_ENV), so put the manifests back as soon as publishing is
  // done, even if it fails, instead of leaving them dirty in the working tree.
  const manifests = snapshotManifests();
  try {
    await releaseVersion({
      specifier: e2eVersion,
      stageChanges: false,
      gitCommit: false,
      gitTag: false,
      firstRelease: true,
      versionActionsOptionsOverrides: {
        skipLockFileUpdate: true,
      },
    });
    // Pass the registry explicitly so it is forwarded to `pnpm publish` as a
    // CLI arg (`--@nxlv:registry=<registry>`). This is required because the
    // @nxlv scope is pinned to real npm in the user's ~/.npmrc, and env-var
    // overrides don't reliably reach the publish child process (Nx daemon /
    // pre-forked workers snapshot the env before this runs).
    await releasePublish({
      tag: 'e2e',
      firstRelease: true,
      registry,
    });
  } catch (error) {
    stopLocalRegistry();
    throw error;
  } finally {
    restoreManifests(manifests);
  }

  return () => {
    stopLocalRegistry();
  };
};
