import { ExecutorContext } from '@nrwl/devkit';
import { ToxExecutorSchema } from './schema';
import buildExecutor from '../build/executor';
import path from 'path';
import chalk from 'chalk';
import { Logger } from '../utils/logger';
import { execSync } from 'child_process';
import { readdirSync, existsSync } from 'fs-extra';

const logger = new Logger();

export default async function runExecutor(
  options: ToxExecutorSchema,
  context: ExecutorContext
) {
  logger.setOptions(options);
  try {
    const projectConfig = context.workspace.projects[context.projectName];
    const distFolder = path.join(projectConfig.root, 'dist');

    const buildResult = await buildExecutor(
      {
        silent: options.silent,
        keepBuildFolder: false,
        ignorePaths: ['.venv', '.tox', 'tests'],
        outputPath: distFolder,
      },
      context
    );

    if (!buildResult.success) {
      return buildResult;
    }

    if (!existsSync(distFolder)) {
      throw new Error(chalk`Folder {blue.bold ${distFolder}} not found`)
    }

    const packageFile = readdirSync(distFolder).find((file) =>
      file.endsWith('.tar.gz')
    );

    if (!packageFile) {
      throw new Error(chalk`No package file {blue.bold *.tar.gz} found in the {bold ${distFolder}}`)
    }

    const packagePath = path.relative(projectConfig.root, path.join(distFolder, packageFile))

    const command = `poetry run tox --installpkg ${packagePath} ${options.args ?? ""}`;
    logger.info(chalk`\n  Running Command: {bold ${command}}\n`);
    execSync(command, {
      cwd: projectConfig.root,
      stdio: 'inherit',
    });

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
