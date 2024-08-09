import { ExecutorContext } from '@nx/devkit';
import chalk from 'chalk';
import { UpdateExecutorSchema } from './schema';
import {
  activateVenv,
  checkPoetryExecutable,
  runPoetry,
  updateProject,
} from '../utils/poetry';
import { updateDependencyTree } from '../../dependency/update-dependency';
import { existsSync } from 'fs-extra';

export default async function executor(
  options: UpdateExecutorSchema,
  context: ExecutorContext,
) {
  const workspaceRoot = context.root;
  process.chdir(workspaceRoot);

  try {
    activateVenv(workspaceRoot);
    await checkPoetryExecutable();
    const projectConfig = context.workspace.projects[context.projectName];
    const rootPyprojectToml = existsSync('pyproject.toml');

    if (options.local && options.name) {
      console.log(
        chalk`\n  {bold Updating {bgBlue  ${options.name} } workspace dependency...}\n`,
      );

      if (
        !Object.keys(context.workspace.projects).some(
          (projectName) => options.name === projectName,
        )
      ) {
        throw new Error(
          chalk`\n  {red.bold ${options.name}} workspace project does not exist\n`,
        );
      }

      updateProject(projectConfig.root, rootPyprojectToml);
    } else {
      if (options.name) {
        console.log(
          chalk`\n  {bold Updating {bgBlue  ${options.name} } dependency...}\n`,
        );
      } else {
        console.log(chalk`\n  {bold Updating project dependencies...}\n`);
      }

      const updateArgs = ['update']
        .concat(options.name ? [options.name] : [])
        .concat(options.args ? options.args.split(' ') : [])
        .concat(rootPyprojectToml ? ['--lock'] : []);
      runPoetry(updateArgs, { cwd: projectConfig.root });
    }

    updateDependencyTree(context);

    console.log(
      chalk`\n  {green.bold '${options.name}'} {green dependency has been successfully added to the project}\n`,
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
