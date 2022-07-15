import { ExecutorContext } from '@nrwl/devkit';
import chalk from 'chalk';
import spawn from 'cross-spawn';
import { Logger } from '../utils/logger';
import { Flake8ExecutorSchema } from './schema';
import path from 'path'
import {
  mkdirsSync,
  existsSync
} from 'fs-extra';

const logger = new Logger();

export default async function executor(
  options: Flake8ExecutorSchema,
  context: ExecutorContext
) {
  logger.setOptions(options);
  const workspaceRoot = context.root;
  process.chdir(workspaceRoot)
  try {
    logger.info(
      chalk`\n  {bold Running flake8 linting on project {bgBlue  ${context.projectName} }...}\n`
    );

    const projectConfig = context.workspace.projects[context.projectName];
    const cwd = projectConfig.root

    const absPath = path.resolve(options.outputFile)
    const reportFolder = path.dirname(absPath)
    if (!existsSync(reportFolder)) {
      mkdirsSync(reportFolder)
    }

    const executable = 'poetry'
    const lintingArgs = ['run', 'flake8', '--output-file', absPath]
    spawn.sync(executable, lintingArgs, {
      cwd: cwd,
      shell: false,
      stdio: 'inherit'
    });

    console.log(
      chalk`\n  {green All files pass linting.}\n`
    );

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
