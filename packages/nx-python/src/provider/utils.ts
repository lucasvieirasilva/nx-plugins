import toml, { JsonMap } from '@iarna/toml';
import { ExecutorContext, Tree } from '@nx/devkit';
import chalk from 'chalk';
import { existsSync, readFileSync } from 'fs';
import { sep } from 'node:path';

export const getPyprojectData = <T>(pyprojectToml: string): T => {
  if (!existsSync(pyprojectToml)) {
    return {} as T;
  }

  const content = readFileSync(pyprojectToml).toString('utf-8');
  if (content.trim() === '') return {} as T;

  return toml.parse(content) as T;
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

// Skip __pycache__ during recursive copies: CPython writes .pyc files atomically
// (temp file then rename), which races with readdir+lstat walks and surfaces ENOENT.
export const pycacheFilter = (src: string): boolean =>
  !src.split(sep).includes('__pycache__');

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
