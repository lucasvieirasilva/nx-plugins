export type PoetryPyprojectTomlDependency =
  | string
  | {
      path?: string;
      version?: string;
      markers?: string;
      optional?: boolean;
      extras?: string[];
      develop?: boolean;
      git?: string;
      rev?: string;
      source?: string;
    };

export type PoetryPyprojectTomlDependencies = {
  [key: string]: PoetryPyprojectTomlDependency;
};

export type PoetryPyprojectTomlSource = {
  name: string;
  url: string;
};

/**
 * Per-dependency plugin settings for a Poetry project, declared under
 * `[tool.nx.dependencies.<package-name>]`.
 *
 * Poetry rejects unknown keys inside a dependency table and forbids `version`
 * alongside `path`, so a local workspace dependency has nowhere in
 * `[tool.poetry.dependencies]` to record the version range it should be
 * published with. The `tool.nx` namespace is the manifest's escape hatch for
 * exactly this: Poetry ignores it, and the build reads it.
 */
export type PoetryNxDependency = {
  /**
   * The PEP 440 specifier the built distribution declares for this local
   * dependency, e.g. `>=1.0.0,<2.0.0`. Without it the build pins the
   * dependency to the exact version it was built against.
   *
   * Only used in publish mode (`bundleLocalDependencies: false`), where the
   * dependency is referenced by version rather than bundled into the artifact.
   */
  range?: string;
};

export type PoetryPyprojectToml = {
  tool?: {
    nx?: {
      autoActivate?: boolean;
      /**
       * Whether `nx release` raises the lower bound of a local dependency's
       * {@link PoetryNxDependency.range} to the version just released. Overrides
       * the workspace-wide plugin option for this project only.
       */
      bumpLocalDependencyRange?: boolean;
      /** Per-dependency settings, keyed by the dependency's package name. */
      dependencies?: Record<string, PoetryNxDependency>;
    };
    poetry?: {
      name: string;
      version: string;
      packages?: Array<{
        include: string;
        from?: string;
      }>;
      dependencies?: PoetryPyprojectTomlDependencies;
      group?: {
        [key: string]: {
          dependencies: PoetryPyprojectTomlDependencies;
        };
      };
      extras?: {
        [key: string]: string[];
      };
      plugins?: {
        [key: string]: {
          [key: string]: string;
        };
      };
      source?: PoetryPyprojectTomlSource[];
    };
  };
};
