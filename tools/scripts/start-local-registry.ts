/**
 * This script starts a local registry for e2e testing purposes.
 * It is meant to be used as Vitest's `globalSetup`: the returned function is
 * invoked once, after all e2e tests finish, to tear the registry down.
 */

import { startLocalRegistry } from '@nx/js/plugins/jest/local-registry';
import { releasePublish, releaseVersion } from 'nx/release';

/**
 * Environment variable carrying the `@nxlv/python` version published for this
 * run, read by the specs' workspace harness. Vitest forks its workers after
 * globalSetup, so a variable set here reaches them.
 */
export const E2E_VERSION_ENV = 'NXLV_PYTHON_E2E_VERSION';

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

  return () => {
    stopLocalRegistry();
  };
};
