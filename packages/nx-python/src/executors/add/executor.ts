import { ExecutorContext, ProjectConfiguration } from '@nrwl/devkit';
import { spawnSync } from 'child_process';
import { AddExecutorSchema } from './schema';
import chalk from 'chalk';
import { updateDependencyTree } from '../../dependency/update-dependency';
import { existsSync } from 'fs-extra';
import path from 'path';
import { addLocalProjectToPoetryProject, getLocalDependencyConfig, updateProject } from '../utils/poetry';

export default async function executor(
  options: AddExecutorSchema,
  context: ExecutorContext
) {
  const workspaceRoot = context.root;
  process.chdir(workspaceRoot);
  try {
    const projectConfig = context.workspace.projects[context.projectName];
    const rootPyprojectToml = existsSync('pyproject.toml');

    if (options.local) {
      console.log(
        chalk`\n  {bold Adding {bgBlue  ${options.name} } workspace dependency...}\n`
      );
      updateLocalProject(
        context,
        options.name,
        projectConfig,
        rootPyprojectToml,
        options.group
      );
    } else {
      console.log(
        chalk`\n  {bold Adding {bgBlue  ${options.name} } dependency...}\n`
      );
      const executable = 'poetry';
      const installArgs = ['add', options.name]
        .concat(options.group ? ['--group', options.group] : [])
        .concat(options.args ? options.args.split(' ') : [])
        .concat(rootPyprojectToml ? ['--lock'] : []);
      const installCommand = `${executable} ${installArgs.join(' ')}`;
      console.log(
        chalk`{bold Running command}: ${installCommand} at {bold ${projectConfig.root}} folder\n`
      );
      spawnSync(executable, installArgs, {
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
  updateLockOnly: boolean,
  group?: string
) {
  const dependencyConfig = getLocalDependencyConfig(context, dependencyName);

  const dependencyPath = path.relative(
    projectConfig.root,
    dependencyConfig.root
  );

  const dependencyPkgName = addLocalProjectToPoetryProject(
    projectConfig,
    dependencyConfig,
    dependencyPath,
    group
  );
  updateProject(dependencyPkgName, projectConfig.root, updateLockOnly);
}
