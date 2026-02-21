import { ExecutorContext } from '@nx/devkit';
import chalk from 'chalk';
import { getProvider } from '../../provider';
import { extractBooleanFlag } from '../utils/args';
import { Logger } from '../utils/logger';
import { RuffFormatExecutorSchema } from './schema';

const logger = new Logger();

export default async function executor(
  options: RuffFormatExecutorSchema,
  context: ExecutorContext,
) {
  const workspaceRoot = context.root;
  process.chdir(workspaceRoot);
  try {
    logger.info(
      chalk`\n{bold Running ruff format on project {bgBlue  ${context.projectName} }...}\n`,
    );

    const projectConfig =
      context.projectsConfigurations.projects[context.projectName];

    const unparsedCheck = extractBooleanFlag(options.__unparsed__, '--check');
    options.check = unparsedCheck ?? options.check;

    const commandArgs = ['ruff', 'format']
      .concat(options.filePatterns)
      .concat(options.__unparsed__);

    if (options.check) {
      commandArgs.push('--check');
    }

    const provider = await getProvider(
      workspaceRoot,
      undefined,
      undefined,
      context,
    );
    await provider.run(
      commandArgs,
      workspaceRoot,
      {
        cwd: projectConfig.root,
        log: false,
        error: true,
        shell: true,
      },
      options.installDependenciesIfNotExists,
      context,
    );

    return {
      success: true,
    };
  } catch (error) {
    logger.info(chalk`\n  {bgRed.bold  ERROR } ${error.message}\n`);
    return {
      success: false,
    };
  }
}
