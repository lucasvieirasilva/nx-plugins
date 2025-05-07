import { ExecutorContext, ProjectConfiguration } from '@nx/devkit';
import chalk from 'chalk';
import spawn from 'cross-spawn';
import path from 'path';
import toml from '@iarna/toml';
import fs from 'fs';
import commandExists from 'command-exists';
import {
  SpawnSyncOptions,
  SpawnSyncOptionsWithBufferEncoding,
} from 'child_process';
import { PoetryPyprojectToml, PoetryPyprojectTomlDependencies } from './types';
import semver from 'semver';

export const POETRY_EXECUTABLE = 'poetry';

export async function checkPoetryExecutable() {
  try {
    await commandExists(POETRY_EXECUTABLE);
  } catch (e) {
    throw new Error(
      'Poetry is not installed. Please install Poetry before running this command.',
    );
  }
}

export async function getPoetryVersion(cwd?: string): Promise<string>;

export async function getPoetryVersion(
  context?: ExecutorContext,
): Promise<string>;

export async function getPoetryVersion(
  contextOrCwd?: ExecutorContext | string,
): Promise<string> {
  const options: SpawnSyncOptionsWithBufferEncoding = {};

  if (typeof contextOrCwd === 'string') {
    options.cwd = contextOrCwd;
  } else if (
    contextOrCwd?.projectName &&
    contextOrCwd?.projectsConfigurations?.projects?.[contextOrCwd.projectName]
  ) {
    // Poetry commands don't work if the cwd doesn't have a pyproject.toml file,
    // so, to ensure that the command runs in the correct folder,
    // we set the cwd to the project root folder, when the context is provided.
    const projectConfig =
      contextOrCwd.projectsConfigurations.projects[contextOrCwd.projectName];
    options.cwd = projectConfig.root;
  }

  const result = spawn.sync(POETRY_EXECUTABLE, ['--version'], options);
  if (result.error) {
    throw new Error(
      'Poetry is not installed. Please install Poetry before running this command.',
    );
  }
  const versionRegex = /version (\d+\.\d+\.\d+)/;
  const match = result.stdout.toString().trim().match(versionRegex);
  const version = match?.[1];
  if (!version) {
    throw new Error('Poetry version not found');
  }

  const cleanedVersion = semver.clean(version);
  if (!cleanedVersion) {
    throw new Error(`Invalid version: ${version}`);
  }

  return cleanedVersion;
}

export function addLocalProjectToPoetryProject(
  targetConfig: ProjectConfiguration,
  dependencyConfig: ProjectConfiguration,
  dependencyPath: string,
  group?: string,
  extras?: string[],
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

export function getProjectTomlPath(targetConfig: ProjectConfiguration) {
  return path.join(targetConfig.root, 'pyproject.toml');
}

export function parseToml(tomlFile: string) {
  return toml.parse(fs.readFileSync(tomlFile, 'utf-8')) as PoetryPyprojectToml;
}

export type RunPoetryOptions = {
  log?: boolean;
  error?: boolean;
} & SpawnSyncOptions;

export function runPoetry(
  args: string[],
  options: RunPoetryOptions = {},
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
      }\n`,
    );
  }

  const result = spawn.sync(POETRY_EXECUTABLE, args, {
    ...options,
    shell: options.shell ?? false,
    stdio: 'inherit',
  });

  if (error && result.status !== 0) {
    throw new Error(
      chalk`{bold ${commandStr}} command failed with exit code {bold ${result.status}}`,
    );
  }
}

export const getProjectPackageName = (
  context: ExecutorContext,
  projectName: string,
): string => {
  const projectConfig = context.projectsConfigurations.projects[projectName];
  const projectToml = getProjectTomlPath(projectConfig);
  const {
    tool: {
      poetry: { name },
    },
  } = parseToml(projectToml);

  return name;
};

/**
 * Parses all dependency names from a Pyproject.toml file
 * and returns a flattened collection of dependencies
 *
 * Optionally you may supply a list of groups to ignore
 */
export const getAllDependenciesFromPyprojectToml = (
  tomlData: PoetryPyprojectToml,
  /** optional dependency groups to omit from collection */
  omitGroups: string[] = [],
): PoetryPyprojectTomlDependencies => {
  return {
    ...(tomlData.tool?.poetry?.dependencies ?? {}),
    ...Object.fromEntries(
      Object.entries(tomlData.tool?.poetry?.group ?? {})
        .filter(([name]) => !omitGroups.includes(name))
        .flatMap(([, group]) => Object.entries(group.dependencies ?? {})),
    ),
  };
};
