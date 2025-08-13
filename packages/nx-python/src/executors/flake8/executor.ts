import { ExecutorContext } from '@nx/devkit';
import chalk from 'chalk';
import { Logger } from '../utils/logger';
import { Flake8ExecutorSchema } from './schema';
import path from 'path';
import { mkdirsSync, existsSync, readFileSync, rmSync } from 'fs-extra';
import { getProvider } from '../../provider';

const logger = new Logger();

export default async function executor(
  options: Flake8ExecutorSchema,
  context: ExecutorContext,
) {
  logger.setOptions(options);
  const workspaceRoot = context.root;
  process.chdir(workspaceRoot);
  try {
    logger.info(
      chalk`\n  {bold Running flake8 linting on project {bgBlue  ${context.projectName} }...}\n`,
    );

    const projectConfig =
      context.projectsConfigurations.projects[context.projectName];
    const cwd = projectConfig.root;

    const absPath = path.resolve(options.outputFile);
    const reportFolder = path.dirname(absPath);
    if (!existsSync(reportFolder)) {
      mkdirsSync(reportFolder);
    }

    if (existsSync(absPath)) {
      rmSync(absPath, { force: true });
    }

    const lintingArgs = ['flake8', '--output-file', absPath];
    const provider = await getProvider(
      workspaceRoot,
      undefined,
      undefined,
      context,
    );
    await provider.run(
      lintingArgs,
      workspaceRoot,
      {
        cwd,
        log: false,
        error: false,
      },
      options.installDependenciesIfNotExists,
      context,
    );

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
