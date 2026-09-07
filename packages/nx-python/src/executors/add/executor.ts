import { ExecutorContext } from '@nx/devkit';
import { AddExecutorSchema } from './schema';
import chalkTemplate from 'chalk-template';
import { getProvider } from '../../provider';

export default async function executor(
  options: AddExecutorSchema,
  context: ExecutorContext,
) {
  const workspaceRoot = context.root;
  process.chdir(workspaceRoot);
  try {
    const provider = await getProvider(
      workspaceRoot,
      undefined,
      undefined,
      context,
    );
    await provider.add(options, context);
    return {
      success: true,
    };
  } catch (error) {
    console.log(chalkTemplate`\n  {bgRed.bold  ERROR } ${error.message}\n`);
    return {
      success: false,
    };
  }
}
