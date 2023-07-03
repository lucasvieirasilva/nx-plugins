import { ExecutorContext, ProjectConfiguration } from '@nx/devkit';
import { AddExecutorSchema } from './schema';
import chalk from 'chalk';
import { updateDependencyTree } from '../../dependency/update-dependency';
import { existsSync } from 'fs-extra';
import path from 'path';
import {
  activateVenv,
  addLocalProjectToPoetryProject,
  checkPoetryExecutable,
  getLocalDependencyConfig,
  runPoetry,
  updateProject,
} from '../utils/poetry';

export default async function executor(
  options: AddExecutorSchema,
  context: ExecutorContext
) {
  const workspaceRoot = context.root;
  process.chdir(workspaceRoot);
  try {
    activateVenv(workspaceRoot);
    await checkPoetryExecutable();
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
        options.group,
        options.extras
      );
    } else {
      console.log(
        chalk`\n  {bold Adding {bgBlue  ${options.name} } dependency...}\n`
      );
      const installArgs = ['add', options.name]
        .concat(options.group ? ['--group', options.group] : [])
        .concat(options.args ? options.args.split(' ') : [])
        .concat(
          options.extras ? options.extras.map((ex) => `--extras=${ex}`) : []
        )
        .concat(rootPyprojectToml ? ['--lock'] : []);

      runPoetry(installArgs, { cwd: projectConfig.root });
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
  group?: string,
  extras?: string[]
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
    group,
    extras
  );
  updateProject(dependencyPkgName, projectConfig.root, updateLockOnly);
}
