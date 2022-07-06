export interface Schema {
  name: string;
  type: 'library' | 'application';
  description?: string;
  tags?: string;
  directory?: string;
  customSource: boolean;
  sourceName?: string;
  sourceUrl?: string;
  sourceSecondary?: boolean;
  packageName: string;
  moduleName: string;
  publishable: boolean;
  addDevDependencies: boolean;
}
