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
  tool?: {
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
