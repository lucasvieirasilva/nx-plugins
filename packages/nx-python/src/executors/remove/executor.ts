import { ExecutorContext } from '@nx/devkit';
import chalk from 'chalk';
import { RemoveExecutorSchema } from './schema';
import { getProvider } from '../../provider';

export default async function executor(
  options: RemoveExecutorSchema,
  context: ExecutorContext,
) {
  const workspaceRoot = context.root;
  process.chdir(workspaceRoot);
  try {
    const provider = await getProvider(workspaceRoot);
    await provider.remove(options, context);

    return {
      success: true,
    };
  } catch (error) {
    console.log(chalk`\n  {bgRed.bold  ERROR } ${error.message}\n`);
    return {
      success: false,
    };
  }
}
