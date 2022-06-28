import { ProjectConfiguration } from '@nrwl/devkit';
import chalk from 'chalk';
import { spawnSync } from 'child_process';
import path from 'path';
import toml from '@iarna/toml';
import fs from 'fs';

export function addLocalProjectToPoetryProject(
  targetConfig: ProjectConfiguration,
  dependencyConfig: ProjectConfiguration,
  dependencyPath: string
): string {
  const targetToml = getProjectTomlPath(targetConfig);
  const dependencyToml = getProjectTomlPath(dependencyConfig);
  const targetTomlData = parseToml(targetToml);
  const dependencyTomlData = parseToml(dependencyToml);

  const dependencyName = dependencyTomlData.tool.poetry.name;
  targetTomlData.tool.poetry.dependencies[dependencyName] = {
    path: dependencyPath,
    develop: true,
  };

  fs.writeFileSync(targetToml, toml.stringify(targetTomlData));

  return dependencyName;
}

export function updateProject(projectName: string, cwd: string) {
  const executable = 'poetry'
  const updateLockArgs = ['update', projectName]
  const updateLockCommand = `${executable} ${updateLockArgs.join(" ")}`;
  console.log(
    chalk`{bold Running command}: ${updateLockCommand} at {bold ${cwd}} folder\n`
  );
  spawnSync(executable, updateLockArgs, {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any;
}
