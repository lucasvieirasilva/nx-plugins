import { ExecutorContext } from '@nx/devkit';
import chalk from 'chalk';
import { Logger } from '../utils/logger';
import { Flake8ExecutorSchema } from './schema';
import path from 'path';
import { mkdirsSync, existsSync, readFileSync, rmSync } from 'fs-extra';
import {
  activateVenv,
  checkPoetryExecutable,
  runPoetry,
} from '../utils/poetry';

const logger = new Logger();

export default async function executor(
  options: Flake8ExecutorSchema,
  context: ExecutorContext,
) {
  logger.setOptions(options);
  const workspaceRoot = context.root;
  process.chdir(workspaceRoot);
  try {
    activateVenv(workspaceRoot);
    await checkPoetryExecutable();
    logger.info(
      chalk`\n  {bold Running flake8 linting on project {bgBlue  ${context.projectName} }...}\n`,
    );

    const projectConfig = context.workspace.projects[context.projectName];
    const cwd = projectConfig.root;

    const absPath = path.resolve(options.outputFile);
    const reportFolder = path.dirname(absPath);
    if (!existsSync(reportFolder)) {
      mkdirsSync(reportFolder);
    }

    if (existsSync(absPath)) {
      rmSync(absPath, { force: true });
    }

    const lintingArgs = ['run', 'flake8', '--output-file', absPath];
    runPoetry(lintingArgs, { cwd, log: false, error: false });

    const output = readFileSync(absPath, 'utf8');
    const lines = output.split('\n').length;
    if (lines > 1) {
      logger.info(chalk`\n  {bgRed.bold  ERROR } linting issues\n${output}`);
      return { success: false };
    }

    logger.info(chalk`\n  {green All files pass linting.}\n`);

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
