import { ExecutorContext } from '@nx/devkit';
import chalkTemplate from 'chalk-template';
import { RemoveExecutorSchema } from './schema';
import { getProvider } from '../../provider';

export default async function executor(
  options: RemoveExecutorSchema,
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
    await provider.remove(options, context);

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
