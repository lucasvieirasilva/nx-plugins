export interface PoetryProjectGeneratorSchema {
  name: string;
  projectType: 'application' | 'library';
  packageName?: string;
  moduleName?: string;
  description?: string;
  pyprojectPythonDependency: string;
  pyenvPythonVersion: string;
  publishable: boolean;
  buildLockedVersions: boolean;
  buildBundleLocalDependencies: boolean;
  linter: 'flake8' | 'none';
  unitTestRunner: 'pytest' | 'none';
  devDependenciesProject?: string;
  rootPyprojectDependencyGroup: string;
  unitTestHtmlReport: boolean;
  unitTestJUnitReport: boolean;
  codeCoverage: boolean;
  codeCoverageHtmlReport: boolean;
  codeCoverageXmlReport: boolean;
  codeCoverageThreshold?: number;
  tags?: string;
  directory?: string;
  templateDir?: string;
}
