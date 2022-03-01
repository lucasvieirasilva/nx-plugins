import { ExecutorContext } from '@nrwl/devkit';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { updateDependencyTree } from '../../dependency/update-dependency';
import { getLocalDependencyConfig } from '../update/executor';
import { getProjectTomlPath, parseToml } from '../utils/poetry';
import { RemoveExecutorSchema } from './schema';

export default async function runExecutor(
  options: RemoveExecutorSchema,
  context: ExecutorContext
) {
  try {
    const projectConfig = context.workspace.projects[context.projectName];
    console.log(
      chalk`\n  {bold Removing {bgBlue  ${options.name} } dependency...}\n`
    );

    let dependencyName = options.name;
    if (options.local) {
      const dependencyConfig = getLocalDependencyConfig(context, options.name);

      const pyprojectTomlPath = getProjectTomlPath(dependencyConfig);
      const {
        tool: {
          poetry: { name },
        },
      } = parseToml(pyprojectTomlPath);

      dependencyName = name;
    }

    const removeCommand = `poetry remove ${dependencyName} ${
      options.args ?? ''
    }`;
    console.log(
      chalk`{bold Running command}: ${removeCommand} at {bold ${projectConfig.root}} folder\n`
    );
    execSync(removeCommand, {
      cwd: projectConfig.root,
      stdio: 'inherit',
    });

    updateDependencyTree(context);

    console.log(
      chalk`\n  {green.bold '${options.name}'} {green dependency has been successfully removed}\n`
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
