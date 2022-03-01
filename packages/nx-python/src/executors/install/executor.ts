import { InstallExecutorSchema } from './schema';
import { Logger } from '../utils/logger';
import { ExecutorContext } from '@nrwl/devkit';
import chalk from 'chalk';
import { execSync, ExecSyncOptions } from 'child_process';
import path from 'path'

const logger = new Logger();

export default async function runExecutor(
  options: InstallExecutorSchema,
  context: ExecutorContext
) {
  logger.setOptions(options);
  try {
    const projectConfig = context.workspace.projects[context.projectName];
    let verboseArg = '-v'

    if (options.debug) {
      verboseArg = '-vvv'
    } else if (options.verbose) {
      verboseArg = '-vv'
    }

    const command = `poetry install ${verboseArg} ${options.args ?? ""}`
    logger.info(chalk`\n  Running Command: {bold ${command}}\n`);
    const execOpts: ExecSyncOptions = {
      stdio: 'inherit',
      cwd: projectConfig.root
    }

    if (options.cacheDir) {
      execOpts.env = {
        ...process.env,
        POETRY_CACHE_DIR: path.resolve(options.cacheDir)
      }
    }

    execSync(command, execOpts)

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
