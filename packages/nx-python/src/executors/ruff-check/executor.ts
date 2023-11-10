import { ExecutorContext } from '@nx/devkit';
import chalk from 'chalk';
import { Logger } from '../utils/logger';
import { RuffCheckExecutorSchema } from './schema';
import path from 'path';
import {
  POETRY_EXECUTABLE,
  activateVenv,
  checkPoetryExecutable,
} from '../utils/poetry';
import spawn from 'cross-spawn';

const logger = new Logger();

export default async function executor(
  options: RuffCheckExecutorSchema,
  context: ExecutorContext
) {
  const workspaceRoot = context.root;
  process.chdir(workspaceRoot);
  try {
    activateVenv(workspaceRoot);
    await checkPoetryExecutable();
    logger.info(
      chalk`\n{bold Running ruff check on project {bgBlue  ${context.projectName} }...}\n`
    );

    const projectConfig = context.workspace.projects[context.projectName];

    const commandArgs = ['run', 'ruff', 'check']
      .concat(options.lintFilePatterns)
      .concat(options.__unparsed__);

    await runCheck(commandArgs, projectConfig.root);

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

function runCheck(commandArgs: string[], cwd: string) {
  const command = `${POETRY_EXECUTABLE} ${commandArgs.join(' ')}`;
  const result = spawn.sync(command, {
    stdio: 'inherit',
    shell: true,
    cwd,
  });

  if (result.status !== 0) {
    throw new Error('Ruff check failed.');
  }
}
