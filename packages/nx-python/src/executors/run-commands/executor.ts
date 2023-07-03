import { ExecutorContext } from '@nx/devkit';
import baseExecutor, {
  RunCommandsOptions,
} from 'nx/src/executors/run-commands/run-commands.impl';
import { activateVenv } from '../utils/poetry';

export default async function executor(
  options: RunCommandsOptions,
  context: ExecutorContext
) {
  activateVenv(context.root);
  return baseExecutor(options, context);
}
