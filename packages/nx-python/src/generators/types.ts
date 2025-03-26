export interface PytestGeneratorSchema {
  unitTestRunner: 'pytest' | 'none';
  codeCoverage: boolean;
  codeCoverageHtmlReport: boolean;
  codeCoverageXmlReport: boolean;
  codeCoverageThreshold?: number;
  unitTestHtmlReport: boolean;
  unitTestJUnitReport: boolean;
}

export interface BasePythonProjectGeneratorSchema
  extends PytestGeneratorSchema {
  name: string;
  publishable: boolean;
  buildLockedVersions: boolean;
  buildBundleLocalDependencies: boolean;
  linter: 'flake8' | 'ruff' | 'none';
  devDependenciesProject?: string;
  rootPyprojectDependencyGroup: string;
  templateDir?: string;
  pyprojectPythonDependency: string;
  projectType: 'application' | 'library';
  projectNameAndRootFormat: 'as-provided' | 'derived';
  packageName?: string;
  description?: string;
  moduleName?: string;
  pyenvPythonVersion?: string | number;
  tags?: string;
  directory?: string;
}

export interface BaseNormalizedSchema extends BasePythonProjectGeneratorSchema {
  projectName: string;
  projectRoot: string;
  pythonAddopts?: string;
  parsedTags: string[];
}
