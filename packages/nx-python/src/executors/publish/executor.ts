import { ExecutorContext, runExecutor } from '@nx/devkit';
import { PublishExecutorSchema } from './schema';
import chalk from 'chalk';
import { Logger } from '../utils/logger';
import {
  activateVenv,
  checkPoetryExecutable,
  runPoetry,
} from '../utils/poetry';
import { BuildExecutorOutput } from '../build/schema';
import { removeSync } from 'fs-extra';

const logger = new Logger();

export default async function executor(
  options: PublishExecutorSchema,
  context: ExecutorContext,
) {
  logger.setOptions(options);
  const workspaceRoot = context.root;
  process.chdir(workspaceRoot);
  try {
    activateVenv(workspaceRoot);
    await checkPoetryExecutable();

    let buildFolderPath = '';

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

    await runPoetry(['publish', ...(options.__unparsed__ ?? [])], {
      cwd: buildFolderPath,
    });

    removeSync(buildFolderPath);

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
