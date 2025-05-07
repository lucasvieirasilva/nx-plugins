import { ExecutorContext } from '@nx/devkit';
import { ToxExecutorSchema } from './schema';
import buildExecutor from '../build/executor';
import path from 'path';
import chalk from 'chalk';
import { Logger } from '../utils/logger';
import { readdirSync, existsSync } from 'fs-extra';
import { getProvider } from '../../provider';

const logger = new Logger();

export default async function executor(
  options: ToxExecutorSchema,
  context: ExecutorContext,
) {
  const workspaceRoot = context.root;
  process.chdir(workspaceRoot);
  logger.setOptions(options);
  try {
    const provider = await getProvider(
      workspaceRoot,
      undefined,
      undefined,
      context,
    );
    await provider.checkPrerequisites();

    const projectConfig =
      context.projectsConfigurations.projects[context.projectName];
    const distFolder = path.join(projectConfig.root, 'dist');

    const buildResult = await buildExecutor(
      {
        silent: options.silent,
        keepBuildFolder: false,
        ignorePaths: ['.venv', '.tox', 'tests'],
        outputPath: distFolder,
        devDependencies: true,
        lockedVersions: true,
        bundleLocalDependencies: true,
      },
      context,
    );

    if (!buildResult.success) {
      return buildResult;
    }

    if (!existsSync(distFolder)) {
      throw new Error(chalk`Folder {blue.bold ${distFolder}} not found`);
    }

    const packageFile = readdirSync(distFolder).find((file) =>
      file.endsWith('.tar.gz'),
    );

    if (!packageFile) {
      throw new Error(
        chalk`No package file {blue.bold *.tar.gz} found in the {bold ${distFolder}}`,
      );
    }

    const packagePath = path.relative(
      projectConfig.root,
      path.join(distFolder, packageFile),
    );

    const toxArgs = ['tox', '--installpkg', packagePath].concat(
      options.args ? options.args.split(' ') : [],
    );

    await provider.run(
      toxArgs,
      workspaceRoot,
      {
        cwd: projectConfig.root,
      },
      context,
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
