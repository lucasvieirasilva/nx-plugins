import { ExecutorContext } from '@nx/devkit';
import baseExecutor, {
  RunCommandsOptions,
} from 'nx/src/executors/run-commands/run-commands.impl';
import { getProvider } from '../../provider';

export default async function executor(
  options: RunCommandsOptions,
  context: ExecutorContext,
) {
  const provider = await getProvider(
    context.root,
    undefined,
    undefined,
    context,
  );
  await provider.activateVenv(context.root, context);
  return baseExecutor(options, context);
}
