import { ExecutorContext } from '@nrwl/devkit';
import { spawnSync } from 'child_process';
import { AddExecutorSchema } from './schema';
import chalk from 'chalk';
import { updateDependencyTree } from '../../dependency/update-dependency';
import { updateLocalProject } from '../update/executor';

export default async function executor(
  options: AddExecutorSchema,
  context: ExecutorContext
) {
  try {
    const projectConfig = context.workspace.projects[context.projectName];

    if (options.local) {
      console.log(
        chalk`\n  {bold Adding {bgBlue  ${options.name} } workspace dependency...}\n`
      );
      updateLocalProject(context, options.name, projectConfig);
    } else {
      console.log(
        chalk`\n  {bold Adding {bgBlue  ${options.name} } dependency...}\n`
      );
      const executable = "poetry"
      const installArgs = ['add', options.name].concat(options.args ? options.args.split(' ') : [])
      const installCommand = `${executable} ${installArgs.join(" ")}`;
      console.log(
        chalk`{bold Running command}: ${installCommand} at {bold ${projectConfig.root}} folder\n`
      );
      spawnSync(executable, installArgs, {
        cwd: projectConfig.root,
        shell: false,
        stdio: 'inherit'
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
