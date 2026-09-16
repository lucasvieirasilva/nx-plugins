export type UVPyprojectToml = {
  project?: {
    name: string;
    version: string;
    dependencies: string[];
    'optional-dependencies': {
      [key: string]: string[];
    };
  };
  'dependency-groups': {
    [key: string]: string[];
  };
  'build-system'?: {
    requires?: string[];
    'build-backend'?: string;
  };
  tool?: {
    nx?: {
      /**
       * Whether `nx release` raises the lower bound of a local dependency's
       * version specifier to the version just released. Overrides the
       * workspace-wide plugin option for this project only.
       *
       * uv expresses a local dependency's range in the standard
       * `[project].dependencies` specifier (e.g. `mylib>=1.0.0,<2.0.0`), with
       * `[tool.uv.sources]` supplying the local resolution, so there is no
       * `tool.nx` range key here as there is for Poetry.
       */
      bumpLocalDependencyRange?: boolean;
    };
    hatch?: {
      build?: {
        targets?: {
          wheel?: {
            packages: string[];
          };
        };
      };
      metadata?: {
        'allow-direct-references'?: boolean;
      };
    };
    uv?: {
      sources?: {
        [key: string]: {
          path?: string;
          workspace?: boolean;
          index?: string;
        };
      };
      index?: UVPyprojectTomlIndex[];
      workspace?: {
        members: string[];
      };
      'build-backend'?: {
        'module-name'?: string[];
        namespace?: boolean;
      };
    };
  };
};

export type UVPyprojectTomlIndex = {
  name: string;
  url: string;
};

export type UVLockfilePackageLocalSource = {
  editable?: string;
};

export type UVLockfilePackageDependency = {
  name: string;
  extra?: string[];
};

export type UVLockfilePackageMetadata = {
  'requires-dist': Record<string, UVLockfilePackageMetadataRequiresDist>;
  'requires-dev': Record<
    string,
    Record<string, UVLockfilePackageMetadataRequiresDist>
  >;
};

export type UVLockfilePackageMetadataRequiresDist = {
  name: string;
  specifier: string;
  extras?: string[];
  editable?: string;
};

export type UVLockfilePackage = {
  name: string;
  version: string;
  source: UVLockfilePackageLocalSource;
  dependencies: UVLockfilePackageDependency[];
  'optional-dependencies': {
    [key: string]: UVLockfilePackageDependency[];
  };
  'dev-dependencies': {
    [key: string]: UVLockfilePackageDependency[];
  };
  metadata: UVLockfilePackageMetadata;
};

export type UVLockfile = {
  package: Record<string, UVLockfilePackage>;
};
