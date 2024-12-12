export type UVPyprojectToml = {
  project?: {
    name: string;
    version: string;
    dependencies: string[];
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
    };
    uv?: {
      sources?: {
        [key: string]: {
          workspace?: boolean;
        };
      };
    };
  };
};

export type UVLockfilePackageLocalSource = {
  editable?: boolean;
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
  'dev-dependencies': {
    [key: string]: UVLockfilePackageDependency[];
  };
  metadata: UVLockfilePackageMetadata;
};

export type UVLockfile = {
  package: Record<string, UVLockfilePackage>;
};
