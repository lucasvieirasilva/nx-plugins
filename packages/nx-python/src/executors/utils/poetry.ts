import { ExecutorContext, ProjectConfiguration } from '@nrwl/devkit';
import chalk from 'chalk';
import spawn from 'cross-spawn';
import path from 'path';
import toml from '@iarna/toml';
import fs from 'fs';
import { PyprojectToml } from '../../graph/dependency-graph';
import commandExists from 'command-exists';
import { SpawnSyncOptions } from 'child_process';

export const POETRY_EXECUTABLE = 'poetry';

export async function checkPoetryExecutable() {
  try {
    await commandExists(POETRY_EXECUTABLE);
  } catch (e) {
    throw new Error(
      'Poetry is not installed. Please install Poetry before running this command.'
    );
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
    targetTomlData.tool.poetry.group = targetTomlData.tool.poetry.group || {};
    targetTomlData.tool.poetry.group[group] = targetTomlData.tool.poetry.group[
      group
    ] || { dependencies: {} };
    targetTomlData.tool.poetry.group[group].dependencies[dependencyName] = {
      path: dependencyPath,
      develop: true,
      ...(extras ? { extras } : {}),
    };
  } else {
    targetTomlData.tool.poetry.dependencies[dependencyName] = {
      path: dependencyPath,
      develop: true,
      ...(extras ? { extras } : {}),
    };
  }

  fs.writeFileSync(targetToml, toml.stringify(targetTomlData));

  return dependencyName;
}

export function updateProject(
  projectName: string,
  cwd: string,
  updateLockOnly: boolean
) {
  const updateLockArgs = ['update', projectName].concat(
    updateLockOnly ? ['--lock'] : []
  );
  runPoetry(updateLockArgs, { cwd });
}

export function getProjectTomlPath(targetConfig: ProjectConfiguration) {
  return path.join(targetConfig.root, 'pyproject.toml');
}

export function parseToml(tomlFile: string) {
  return toml.parse(fs.readFileSync(tomlFile, 'utf-8')) as PyprojectToml;
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

export type RunPoetryOptions = {
  log?: boolean;
  error?: boolean;
} & SpawnSyncOptions;

export function runPoetry(
  args: string[],
  options: RunPoetryOptions = {}
): void {
  const log = options.log ?? true;
  const error = options.error ?? true;
  delete options.log;
  delete options.error;

  const commandStr = `${POETRY_EXECUTABLE} ${args.join(' ')}`;

  if (log) {
    console.log(
      chalk`{bold Running command}: ${commandStr} ${
        options.cwd && options.cwd !== '.'
          ? chalk`at {bold ${options.cwd}} folder`
          : ''
      }\n`
    );
  }

  const result = spawn.sync(POETRY_EXECUTABLE, args, {
    ...options,
    shell: false,
    stdio: 'inherit',
  });

  if (error && result.status !== 0) {
    throw new Error(
      chalk`{bold ${commandStr}} command failed with exit code {bold ${result.status}}`
    );
  }
}
