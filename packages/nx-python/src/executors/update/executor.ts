import { ExecutorContext } from '@nx/devkit';
import chalk from 'chalk';
import { UpdateExecutorSchema } from './schema';
import { getProvider } from '../../provider';

export default async function executor(
  options: UpdateExecutorSchema,
  context: ExecutorContext,
) {
  const workspaceRoot = context.root;
  process.chdir(workspaceRoot);

  try {
    const provider = await getProvider(workspaceRoot);
    await provider.update(options, context);

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
