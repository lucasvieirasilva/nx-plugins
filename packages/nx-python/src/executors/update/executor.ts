import { ExecutorContext, ProjectConfiguration } from '@nrwl/devkit';
import chalk from 'chalk';
import { UpdateExecutorSchema } from './schema';
import path from 'path';
import { addLocalProjectToPoetryProject, updateProject } from '../utils/poetry';
import { spawnSync } from 'child_process';
import { updateDependencyTree } from '../../dependency/update-dependency';
import { existsSync } from 'fs-extra';

export default async function executor(
  options: UpdateExecutorSchema,
  context: ExecutorContext
) {
  try {
    const projectConfig = context.workspace.projects[context.projectName];
    const rootPyprojectToml = existsSync('pyproject.toml')

    if (options.local && options.name) {
      console.log(
        chalk`\n  {bold Updating {bgBlue  ${options.name} } workspace dependency...}\n`
      );
      updateLocalProject(context, options.name, projectConfig, rootPyprojectToml);
    } else {
      if (options.name) {
        console.log(
          chalk`\n  {bold Updating {bgBlue  ${options.name} } dependency...}\n`
        );
      } else {
        console.log(chalk`\n  {bold Updating project dependencies...}\n`);
      }

      const executable = 'poetry';
      const updateArgs = ['update']
        .concat(options.name ? [options.name] : [])
        .concat(options.args ? options.args.split(' ') : [])
        .concat(rootPyprojectToml ? ['--lock'] : []);
      const updateCommand = `${executable} ${updateArgs.join(' ')}`;
      console.log(
        chalk`{bold Running command}: ${updateCommand} at {bold ${projectConfig.root}} folder\n`
      );
      spawnSync(executable, updateArgs, {
        cwd: projectConfig.root,
        shell: false,
        stdio: 'inherit',
      });
    }

    updateDependencyTree(context);

    console.log(
      chalk`\n  {green.bold '${options.name}'} {green dependency has been successfully added to the project}\n`
    );

    return {
      success: true,
    };
  } catch (error) {
    console.log(chalk`\n  {bgRed.bold  ERROR } ${error.message}\n`);
    return {
      success: false,
    };
  }
}

export function updateLocalProject(
  context: ExecutorContext,
  dependencyName: string,
  projectConfig: ProjectConfiguration,
  updateLockOnly: boolean
) {
  const dependencyConfig = getLocalDependencyConfig(context, dependencyName);

  const dependencyPath = path.relative(
    projectConfig.root,
    dependencyConfig.root
  );

  const dependencyPkgName = addLocalProjectToPoetryProject(
    projectConfig,
    dependencyConfig,
    dependencyPath
  );
  updateProject(dependencyPkgName, projectConfig.root, updateLockOnly);
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
