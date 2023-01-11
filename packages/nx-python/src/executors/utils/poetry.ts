import { ExecutorContext, ProjectConfiguration } from '@nrwl/devkit';
import chalk from 'chalk';
import spawn from 'cross-spawn';
import path from 'path';
import toml from '@iarna/toml';
import fs from 'fs';
import { PyprojectToml } from '../../graph/dependency-graph';
import commandExists from 'command-exists'

export const POETRY_EXECUTABLE = 'poetry'

export async function checkPoetryExecutable() {
  try {
    await commandExists(POETRY_EXECUTABLE)
  } catch (e) {
    throw new Error('Poetry is not installed. Please install Poetry before running this command.')
  }
}

export function addLocalProjectToPoetryProject(
  targetConfig: ProjectConfiguration,
  dependencyConfig: ProjectConfiguration,
  dependencyPath: string,
  group?: string,
  extras?: string[]
): string {
  const targetToml = getProjectTomlPath(targetConfig);
  const dependencyToml = getProjectTomlPath(dependencyConfig);
  const targetTomlData = parseToml(targetToml);
  const dependencyTomlData = parseToml(dependencyToml);

  const dependencyName = dependencyTomlData.tool.poetry.name;
  if (group) {
    targetTomlData.tool.poetry.group = targetTomlData.tool.poetry.group || {}
    targetTomlData.tool.poetry.group[group] = targetTomlData.tool.poetry.group[group] || { dependencies: {}}
    targetTomlData.tool.poetry.group[group].dependencies[dependencyName] = {
      path: dependencyPath,
      develop: true,
      ...(extras ? { extras } : {})
    };
  } else {
    targetTomlData.tool.poetry.dependencies[dependencyName] = {
      path: dependencyPath,
      develop: true,
      ...(extras ? { extras } : {})
    };
  }

  fs.writeFileSync(targetToml, toml.stringify(targetTomlData));

  return dependencyName;
}

export function updateProject(projectName: string, cwd: string, updateLockOnly: boolean) {
  const updateLockArgs = ['update', projectName].concat(updateLockOnly ? ['--lock'] : [])
  const updateLockCommand = `${POETRY_EXECUTABLE} ${updateLockArgs.join(" ")}`;
  console.log(
    chalk`{bold Running command}: ${updateLockCommand} at {bold ${cwd}} folder\n`
  );
  spawn.sync(POETRY_EXECUTABLE, updateLockArgs, {
    cwd,
    shell: false,
    stdio: 'inherit',
  });
}

export function getProjectTomlPath(targetConfig: ProjectConfiguration) {
  return path.join(targetConfig.root, 'pyproject.toml');
}

export function parseToml(tomlFile: string) {
  return toml.parse(
    fs.readFileSync(tomlFile, 'utf-8')
  ) as PyprojectToml;
}

export function getLocalDependencyConfig(
  context: ExecutorContext,
  dependencyName: string
) {
  const dependencyConfig = context.workspace.projects[dependencyName];
  if (!dependencyConfig) {
    throw new Error(
      chalk`project {bold ${dependencyName}} not found in the Nx workspace`
    );
  }
  return dependencyConfig;
}
