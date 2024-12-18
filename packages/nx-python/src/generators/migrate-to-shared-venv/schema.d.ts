export interface Schema {
  moveDevDependencies: boolean;
  pyprojectPythonDependency: string;
  pyenvPythonVersion: string;
  autoActivate: boolean;
  packageManager: 'poetry' | 'uv';
}
