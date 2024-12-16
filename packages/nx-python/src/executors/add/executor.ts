import { ExecutorContext } from '@nx/devkit';
import { AddExecutorSchema } from './schema';
import chalk from 'chalk';
import { getProvider } from '../../provider';

export default async function executor(
  options: AddExecutorSchema,
  context: ExecutorContext,
) {
  const workspaceRoot = context.root;
  process.chdir(workspaceRoot);
  try {
    const provider = await getProvider(workspaceRoot);
    await provider.add(options, context);
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
