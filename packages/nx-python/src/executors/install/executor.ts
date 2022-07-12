import { InstallExecutorSchema } from './schema';
import { Logger } from '../utils/logger';
import { ExecutorContext } from '@nrwl/devkit';
import chalk from 'chalk';
import { spawnSync, SpawnSyncOptions } from 'child_process';
import path from 'path'

const logger = new Logger();

export default async function executor(
  options: InstallExecutorSchema,
  context: ExecutorContext
) {
  logger.setOptions(options);
  const workspaceRoot = context.root;
  process.chdir(workspaceRoot)
  try {
    const projectConfig = context.workspace.projects[context.projectName];
    let verboseArg = '-v'

    if (options.debug) {
      verboseArg = '-vvv'
    } else if (options.verbose) {
      verboseArg = '-vv'
    }

    const executable = 'poetry'
    const installArgs = ['install', verboseArg].concat(options.args ? options.args.split(' ') : [])
    const command = `${executable} ${installArgs.join(' ')}`
    logger.info(chalk`\n  Running Command: {bold ${command}}\n`);
    const execOpts: SpawnSyncOptions = {
      stdio: 'inherit',
      shell: false,
      cwd: projectConfig.root
    }

    if (options.cacheDir) {
      execOpts.env = {
        ...process.env,
        POETRY_CACHE_DIR: path.resolve(options.cacheDir)
      }
    }

    spawnSync(executable, installArgs, execOpts)

    return {
      success: true,
    };
  } catch (error) {
    logger.info(chalk`\n  {bgRed.bold  ERROR } ${error.message}\n`);
    return {
      success: false,
    };
  }
}
