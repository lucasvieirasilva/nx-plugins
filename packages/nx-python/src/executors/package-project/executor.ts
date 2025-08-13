import { ExecutorContext } from '@nx/devkit';
import chalk from 'chalk';
import { Logger } from '../utils/logger';
import { ExecutorSchema } from './schema';
import path from 'path';
import { existsSync } from 'fs-extra';
import { getProvider } from '../../provider';
import os from 'os';
import fsPromises from 'fs/promises';
import archiver from 'archiver';
import fs from 'fs';

const logger = new Logger();

export default async function executor(
  options: ExecutorSchema,
  context: ExecutorContext,
) {
  const workspaceRoot = context.root;
  process.chdir(workspaceRoot);

  const provider = await getProvider(
    workspaceRoot,
    undefined,
    undefined,
    context,
  );
  await provider.activateVenv(
    workspaceRoot,
    options.installDependenciesIfNotExists ?? false,
    context,
  );

  try {
    logger.info(
      chalk`\n  {bold Packaging project {bgBlue  ${context.projectName} } to {bgBlue  ${options.outputType} } }\n`,
    );

    const targetDir =
      options.outputType === 'folder'
        ? path.dirname(options.outputPath)
        : await fsPromises.mkdtemp(
            path.join(os.tmpdir(), 'nx-python-package-project'),
          );

    if (options.outputType === 'folder') {
      await fsPromises.mkdir(targetDir, { recursive: true });
    }

    const buildFolderPath = await provider.build(
      {
        bundleLocalDependencies: true,
        lockedVersions: true,
        devDependencies: false,
        ignorePaths: options.ignorePaths,
        keepBuildFolder: true,
        silent: true,
        outputPath: options.outputPath,
        skipBuild: true,
        buildFolder: targetDir,
      },
      context,
    );

    if (options.outputType === 'zip') {
      logger.info(chalk`\n  {bold Creating zip file...}\n`);

      const outputDir = path.dirname(options.outputPath);
      if (!existsSync(outputDir)) {
        await fsPromises.mkdir(outputDir, { recursive: true });
      }

      if (existsSync(options.outputPath)) {
        await fsPromises.unlink(options.outputPath);
      }

      const archive = archiver('zip', { zlib: { level: 9 } });

      const outputStream = fs.createWriteStream(options.outputPath);
      archive.pipe(outputStream);

      archive.directory(buildFolderPath, false);

      if (options.includeFiles) {
        for (const file of options.includeFiles) {
          archive.file(path.join(workspaceRoot, file.source), {
            name: file.destination,
          });
        }
      }

      await archive.finalize();

      await new Promise((resolve, reject) => {
        outputStream.on('error', (err) => {
          logger.info(
            chalk`\n  {bgRed.bold  ERROR } Error finalizing archive: ${err.message}\n`,
          );
          reject(err);
        });

        outputStream.on('close', () => {
          logger.info(
            chalk`\n  {bold Zip file created at {bgBlue  ${options.outputPath} } ${archive.pointer()} bytes }\n`,
          );
          resolve(undefined);
        });
      });
    } else {
      logger.info(
        chalk`\n  {bold Folder created at {bgBlue  ${options.outputPath} } }\n`,
      );
    }

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
