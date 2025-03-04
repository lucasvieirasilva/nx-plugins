import { LockExecutorSchema } from './schema';
import { Logger } from '../utils/logger';
import { ExecutorContext } from '@nx/devkit';
import chalk from 'chalk';
import { getProvider } from '../../provider';

const logger = new Logger();

export default async function executor(
  options: LockExecutorSchema,
  context: ExecutorContext,
) {
  logger.setOptions(options);
  const workspaceRoot = context.root;
  process.chdir(workspaceRoot);
  try {
    const provider = await getProvider(
      workspaceRoot,
      logger,
      undefined,
      context,
    );
    await provider.lock(options, context);

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
