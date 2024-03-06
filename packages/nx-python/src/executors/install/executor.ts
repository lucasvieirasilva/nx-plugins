import { InstallExecutorSchema } from './schema';
import { Logger } from '../utils/logger';
import { ExecutorContext } from '@nx/devkit';
import chalk from 'chalk';
import path from 'path';
import {
  checkPoetryExecutable,
  runPoetry,
  RunPoetryOptions,
} from '../utils/poetry';

const logger = new Logger();

export default async function executor(
  options: InstallExecutorSchema,
  context: ExecutorContext,
) {
  logger.setOptions(options);
  const workspaceRoot = context.root;
  process.chdir(workspaceRoot);
  try {
    await checkPoetryExecutable();
    const projectConfig = context.workspace.projects[context.projectName];
    let verboseArg = '-v';

    if (options.debug) {
      verboseArg = '-vvv';
    } else if (options.verbose) {
      verboseArg = '-vv';
    }

    const installArgs = ['install', verboseArg].concat(
      options.args ? options.args.split(' ') : [],
    );

    const execOpts: RunPoetryOptions = {
      cwd: projectConfig.root,
    };

    if (options.cacheDir) {
      execOpts.env = {
        ...process.env,
        POETRY_CACHE_DIR: path.resolve(options.cacheDir),
      };
    }

    runPoetry(installArgs, execOpts);

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
