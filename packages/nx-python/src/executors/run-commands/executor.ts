import { ExecutorContext } from '@nx/devkit';
import baseExecutor, {
  RunCommandsOptions,
} from 'nx/src/executors/run-commands/run-commands.impl';
import { getProvider } from '../../provider';
import { BaseExecutorSchema } from '../base-schema';

export interface RunCommandsExecutorSchema
  extends RunCommandsOptions,
    BaseExecutorSchema {}

export default async function executor(
  options: RunCommandsExecutorSchema,
  context: ExecutorContext,
) {
  const provider = await getProvider(
    context.root,
    undefined,
    undefined,
    context,
  );
  const { installDependenciesIfNotExists, ...props } = options;
  await provider.activateVenv(
    context.root,
    installDependenciesIfNotExists ?? false,
    context,
  );
  return baseExecutor(props, context);
}
