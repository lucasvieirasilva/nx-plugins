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

export type PoetryPyprojectToml = {
  tool?: {
    nx?: {
      autoActivate?: boolean;
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
