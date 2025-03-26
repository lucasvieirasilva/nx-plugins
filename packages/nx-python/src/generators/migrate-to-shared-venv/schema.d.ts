export interface Schema {
  moveDevDependencies: boolean;
  pyprojectPythonDependency: string;
  pyenvPythonVersion: string | number;
  autoActivate: boolean;
  packageManager: 'poetry' | 'uv';
}
