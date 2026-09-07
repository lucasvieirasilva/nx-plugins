import { InstallExecutorSchema } from './schema';
import { Logger } from '../utils/logger';
import { ExecutorContext } from '@nx/devkit';
import chalkTemplate from 'chalk-template';
import { getProvider } from '../../provider';

const logger = new Logger();

export default async function executor(
  options: InstallExecutorSchema,
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
    await provider.install(options, context);

    return {
      success: true,
    };
  } catch (error) {
    logger.info(chalkTemplate`\n  {bgRed.bold  ERROR } ${error.message}\n`);
    return {
      success: false,
    };
  }
}
