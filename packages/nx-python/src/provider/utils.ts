import toml, { JsonMap } from '@iarna/toml';
import { ExecutorContext, Tree } from '@nx/devkit';
import chalk from 'chalk';
import { readFileSync } from 'fs';

export const getPyprojectData = <T>(pyprojectToml: string): T => {
  const content = readFileSync(pyprojectToml).toString('utf-8');
  if (content.trim() === '') return {} as T;

  return toml.parse(readFileSync(pyprojectToml).toString('utf-8')) as T;
};

export const readPyprojectToml = <T>(tree: Tree, tomlFile: string): T => {
  const content = tree.read(tomlFile, 'utf-8');
  if (!content) {
    return null;
  }

  return toml.parse(content) as T;
};

export function writePyprojectToml(
  tree: Tree,
  tomlFile: string,
  data: JsonMap,
) {
  tree.write(tomlFile, toml.stringify(data));
}

export function getLoggingTab(level: number): string {
  return '    '.repeat(level);
}

export function getLocalDependencyConfig(
  context: ExecutorContext,
  dependencyName: string,
) {
  const dependencyConfig =
    context.projectsConfigurations.projects[dependencyName];
  if (!dependencyConfig) {
    throw new Error(
      chalk`project {bold ${dependencyName}} not found in the Nx workspace`,
    );
  }
  return dependencyConfig;
}
