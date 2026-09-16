export type PluginOptions = {
  packageManager?: 'poetry' | 'uv';
  inferDependencies?: boolean;
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
