import { ExecutorContext } from '@nx/devkit';
import chalk from 'chalk';
import { Logger } from '../utils/logger';
import { ExecutorSchema } from './schema';
import path from 'path';
import { existsSync, removeSync } from 'fs-extra';
import { getProvider } from '../../provider';
import os from 'os';
import fsPromises from 'fs/promises';
import spawn from 'cross-spawn';
import archiver from 'archiver';
import fs from 'fs';

const logger = new Logger();

const DEFAULT_IGNORE_PATTERNS: string[] = [
  '**/*.egg-info/**',
  '**/.pytest_cache/**',
  '**/.venv/**',
  '**/.ruff_cache/**',
  '**/dist/**',
  '**/__pycache__/**',
  '**/tests/**',
  '**/README.md',
  '**/poetry.lock',
  '**/poetry.toml',
  '**/pyproject.toml',
  '**/requirements.txt',
];

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

  const buildFolderPath = await provider.build(
    {
      bundleLocalDependencies: true,
      lockedVersions: true,
      devDependencies: false,
      ignorePaths: ['.venv', '.tox', 'tests'],
      keepBuildFolder: true,
      silent: true,
      outputPath: options.outputPath,
      skipBuild: true,
    },
    context,
  );

  try {
    logger.info(
      chalk`\n  {bold Packaging dependencies for project {bgBlue  ${context.projectName} } to {bgBlue  ${options.outputType} } }\n`,
    );

    const targetDir =
      options.outputType === 'folder'
        ? options.outputPath
        : await fsPromises.mkdtemp(
            path.join(os.tmpdir(), 'nx-python-package-dependencies'),
          );

    if (options.outputType === 'folder') {
      await fsPromises.mkdir(
        path.join(targetDir, options.outputSubdirectory ?? ''),
        { recursive: true },
      );
    }

    const requirementsTxtPath = await provider.writeProjectRequirementsTxt(
      buildFolderPath,
      options.extras,
      path.resolve(path.join(targetDir, 'requirements.txt')),
    );

    if (options.ignoreDependencies?.length) {
      const requirementsTxt = await fsPromises.readFile(
        requirementsTxtPath,
        'utf8',
      );
      await fsPromises.writeFile(
        requirementsTxtPath,
        requirementsTxt
          .split('\n')
          .filter(
            (line) =>
              !options.ignoreDependencies.includes(line.split('==', 1)[0]),
          )
          .join('\n'),
      );
    }

    logger.info(chalk`\n  {bold Installing dependencies...}\n`);
    logger.info(chalk`  {bold Python version: ${options.pythonVersion} }`);
    logger.info(chalk`  {bold ABI: ${options.abi} }`);
    logger.info(chalk`  {bold Platform: ${options.platform} }`);
    const pipResult = spawn.sync(
      'pip',
      [
        'install',
        '--python-version',
        options.pythonVersion,
        '--abi',
        options.abi,
        '--platform',
        options.platform,
        '--implementation',
        'cp',
        '--only-binary=:all:',
        '--no-deps',
        '--target',
        options.outputSubdirectory ?? '.',
        '-r',
        requirementsTxtPath,
      ],
      {
        cwd: targetDir,
        shell: false,
        stdio: 'inherit',
      },
    );

    if (pipResult.status !== 0) {
      throw new Error(`pip install failed`);
    }

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

      archive.glob('**/*', {
        cwd: targetDir,
        ignore: options.ignorePatterns ?? DEFAULT_IGNORE_PATTERNS,
      });

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
  } finally {
    if (existsSync(buildFolderPath)) {
      removeSync(buildFolderPath);
    }
  }
}
