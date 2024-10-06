import { ExecutorContext } from '@nx/devkit';
import chalk from 'chalk';
import { existsSync } from 'fs-extra';
import { updateDependencyTree } from '../../dependency/update-dependency';
import {
  activateVenv,
  checkPoetryExecutable,
  getLocalDependencyConfig,
  getPoetryVersion,
  getProjectTomlPath,
  parseToml,
  runPoetry,
} from '../utils/poetry';
import { RemoveExecutorSchema } from './schema';

export default async function executor(
  options: RemoveExecutorSchema,
  context: ExecutorContext,
) {
  const workspaceRoot = context.root;
  process.chdir(workspaceRoot);
  try {
    activateVenv(workspaceRoot);
    await checkPoetryExecutable();
    const rootPyprojectToml = existsSync('pyproject.toml');
    const projectConfig =
      context.projectsConfigurations.projects[context.projectName];
    console.log(
      chalk`\n  {bold Removing {bgBlue  ${options.name} } dependency...}\n`,
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

    const poetryVersion = await getPoetryVersion();
    const hasLockOption = poetryVersion >= '1.5.0';

    const removeArgs = ['remove', dependencyName]
      .concat(options.args ? options.args.split(' ') : [])
      .concat(rootPyprojectToml && hasLockOption ? ['--lock'] : []);
    runPoetry(removeArgs, { cwd: projectConfig.root });

    updateDependencyTree(context);

    console.log(
      chalk`\n  {green.bold '${options.name}'} {green dependency has been successfully removed}\n`,
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
