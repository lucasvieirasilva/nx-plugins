export type PluginOptions = {
  packageManager?: 'poetry' | 'uv';
  inferDependencies?: boolean;
  /**
   * Whether the packages in a uv workspace's `uv.lock` become `pypi` external
   * nodes in the project graph, with each member depending on the ones it
   * installs. Nx then hashes a member's own locked packages into its task
   * hashes, so `uv.lock` no longer has to be an input of every project.
   * Defaults to `false`. Poetry workspaces are not affected.
   */
  externalNodes?: boolean;
  /**
   * Whether every `pyproject.toml` that names a package becomes an Nx project,
   * named after the package, with a test target, so that no `project.json` is
   * needed. A `project.json` in the same directory still applies on top.
   * Defaults to `false`.
   */
  inferProjects?: boolean;
  /**
   * Name of the test target of an inferred project. Defaults to `test`.
   */
  testTargetName?: string;
  /**
   * Globs, relative to the project root, of the files only an inferred
   * project's own tests read. They are left out of its `production` named
   * input, so changing one does not affect the projects that depend on it.
   * Defaults to `tests/**\/*`, `**\/test_*.py`, `**\/*_test.py` and
   * `**\/conftest.py`.
   */
  testFiles?: string[];
  /**
   * Whether `nx release` raises the lower bound of a local workspace
   * dependency's version range to the version just released, so that
   * `>=1.0.0,<2.0.0` becomes `>=1.3.0,<2.0.0` when the dependency releases
   * 1.3.0. Defaults to `true`, which is the historical behavior.
   *
   * Set it to `false` to keep the declared lower bound, which suits a workspace
   * whose libraries declare the widest range they are tested against rather
   * than the newest version they were built against.
   *
   * A project overrides this for itself with `bumpLocalDependencyRange` under
   * `[tool.nx]` in its own `pyproject.toml`.
   */
  bumpLocalDependencyRange?: boolean;
};
