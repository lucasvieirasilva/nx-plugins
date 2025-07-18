import { ExecutorContext } from '@nx/devkit';
import { BuildExecutorOutput, BuildExecutorSchema } from './schema';
import chalk from 'chalk';
import { Logger } from '../utils/logger';
import { getProvider } from '../../provider';

const logger = new Logger();

export default async function executor(
  options: BuildExecutorSchema,
  context: ExecutorContext,
): Promise<BuildExecutorOutput> {
  logger.setOptions(options);
  const workspaceRoot = context.root;
  process.chdir(workspaceRoot);
  try {
    const provider = await getProvider(
      context.root,
      logger,
      undefined,
      context,
    );
    const buildFolderPath = await provider.build(options, context);

    return {
      buildFolderPath,
      success: true,
    };
  } catch (error) {
    console.log(error);
    logger.info(chalk`\n  {bgRed.bold  ERROR } ${error.message}\n`);
    return {
      buildFolderPath: '',
      success: false,
    };
  }
}
