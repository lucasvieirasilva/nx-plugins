import { ExecutorContext, ProjectConfiguration } from '@nrwl/devkit';
import chalk from 'chalk';
import { UpdateExecutorSchema } from './schema';
import {
  getLocalDependencyConfig,
  getProjectTomlPath,
  parseToml,
  updateProject,
} from '../utils/poetry';
import { spawnSync } from 'child_process';
import { updateDependencyTree } from '../../dependency/update-dependency';
import { existsSync } from 'fs-extra';

export default async function executor(
  options: UpdateExecutorSchema,
  context: ExecutorContext
) {
  const workspaceRoot = context.root;
  process.chdir(workspaceRoot);

  try {
    const projectConfig = context.workspace.projects[context.projectName];
    const rootPyprojectToml = existsSync('pyproject.toml');

    if (options.local && options.name) {
      console.log(
        chalk`\n  {bold Updating {bgBlue  ${options.name} } workspace dependency...}\n`
      );
      updateLocalProject(
        context,
        options.name,
        projectConfig,
        rootPyprojectToml
      );
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

function updateLocalProject(
  context: ExecutorContext,
  dependencyName: string,
  projectConfig: ProjectConfiguration,
  updateLockOnly: boolean
) {
  const dependencyConfig = getLocalDependencyConfig(context, dependencyName);
  const dependencyProjectToml = parseToml(getProjectTomlPath(dependencyConfig));

  updateProject(
    dependencyProjectToml.tool.poetry.name,
    projectConfig.root,
    updateLockOnly
  );
}
