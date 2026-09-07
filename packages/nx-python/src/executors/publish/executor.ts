import { ExecutorContext } from '@nx/devkit';
import { PublishExecutorSchema } from './schema';
import chalkTemplate from 'chalk-template';
import { Logger } from '../utils/logger';
import { getProvider } from '../../provider';

const logger = new Logger();

export default async function executor(
  options: PublishExecutorSchema,
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
    await provider.publish(options, context);

    return {
      success: true,
    };
  } catch (error) {
    logger.info(
      chalkTemplate`\n  {bgRed.bold  ERROR } {bold The publish command failed}:\n\n  {bold ${error.message}}\n`,
    );

    return {
      success: false,
    };
  }
}
