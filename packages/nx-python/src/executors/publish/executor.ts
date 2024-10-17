import { ExecutorContext, runExecutor } from '@nx/devkit';
import { PublishExecutorSchema } from './schema';
import chalk from 'chalk';
import { Logger } from '../utils/logger';
import {
  activateVenv,
  checkPoetryExecutable,
  POETRY_EXECUTABLE,
} from '../utils/poetry';
import { BuildExecutorOutput } from '../build/schema';
import { removeSync } from 'fs-extra';
import { spawnPromise } from '../utils/cmd';

const logger = new Logger();

export default async function executor(
  options: PublishExecutorSchema,
  context: ExecutorContext,
) {
  logger.setOptions(options);
  const workspaceRoot = context.root;
  process.chdir(workspaceRoot);
  let buildFolderPath = '';

  try {
    activateVenv(workspaceRoot);
    await checkPoetryExecutable();

    for await (const output of await runExecutor<BuildExecutorOutput>(
      {
        project: context.projectName,
        target: options.buildTarget,
        configuration: context.configurationName,
      },
      {
        keepBuildFolder: true,
      },
      context,
    )) {
      if (!output.success) {
        throw new Error('Build failed');
      }

      buildFolderPath = output.buildFolderPath;
    }

    if (!buildFolderPath) {
      throw new Error('Cannot find the temporary build folder');
    }

    logger.info(
      chalk`\n  {bold Publishing project {bgBlue  ${context.projectName} }...}\n`,
    );

    const commandArgs = [
      'publish',
      ...(options.dryRun ? ['--dry-run'] : []),
      ...(options.__unparsed__ ?? []),
    ];
    const commandStr = `${POETRY_EXECUTABLE} ${commandArgs.join(' ')}`;

    console.log(
      chalk`{bold Running command}: ${commandStr} ${
        buildFolderPath && buildFolderPath !== '.'
          ? chalk`at {bold ${buildFolderPath}} folder`
          : ''
      }\n`,
    );

    await spawnPromise(commandStr, buildFolderPath);
    removeSync(buildFolderPath);

    return {
      success: true,
    };
  } catch (error) {
    if (buildFolderPath) {
      removeSync(buildFolderPath);
    }

    if (typeof error === 'object' && 'code' in error && 'output' in error) {
      if (error.code !== 0 && error.output.includes('File already exists')) {
        logger.info(
          chalk`\n  {bgYellow.bold  WARNING } {bold The package is already published}\n`,
        );

        return {
          success: true,
        };
      } else if (error.code !== 0) {
        logger.info(
          chalk`\n  {bgRed.bold  ERROR } {bold The publish command failed}\n`,
        );
      }
    }

    return {
      success: false,
    };
  }
}
