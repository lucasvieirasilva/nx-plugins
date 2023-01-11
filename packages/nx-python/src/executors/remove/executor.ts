import { ExecutorContext } from '@nrwl/devkit';
import chalk from 'chalk';
import spawn from 'cross-spawn';
import { updateDependencyTree } from '../../dependency/update-dependency';
import { checkPoetryExecutable, getLocalDependencyConfig, getProjectTomlPath, parseToml, POETRY_EXECUTABLE } from '../utils/poetry';
import { RemoveExecutorSchema } from './schema';

export default async function executor(
  options: RemoveExecutorSchema,
  context: ExecutorContext
) {
  const workspaceRoot = context.root;
  process.chdir(workspaceRoot)
  try {
    await checkPoetryExecutable()
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

    const removeArgs = ['remove', dependencyName].concat(options.args ? options.args.split(' ') : [])
    const removeCommand = `${POETRY_EXECUTABLE} ${removeArgs.join(' ')}`;
    console.log(
      chalk`{bold Running command}: ${removeCommand} at {bold ${projectConfig.root}} folder\n`
    );
    spawn.sync(POETRY_EXECUTABLE, removeArgs, {
      cwd: projectConfig.root,
      shell: false,
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
