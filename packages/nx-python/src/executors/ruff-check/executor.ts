import { ExecutorContext } from '@nx/devkit';
import chalk from 'chalk';
import { Logger } from '../utils/logger';
import { RuffCheckExecutorSchema } from './schema';
import { getProvider } from '../../provider';
import { extractBooleanFlag } from '../utils/args';

const logger = new Logger();

export default async function executor(
  options: RuffCheckExecutorSchema,
  context: ExecutorContext,
) {
  const workspaceRoot = context.root;
  process.chdir(workspaceRoot);
  try {
    logger.info(
      chalk`\n{bold Running ruff check on project {bgBlue  ${context.projectName} }...}\n`,
    );

    const projectConfig =
      context.projectsConfigurations.projects[context.projectName];

    const unparsedFix = extractBooleanFlag(options.__unparsed__, '--fix');
    options.fix = unparsedFix ?? options.fix;

    const unparsedExitZero = extractBooleanFlag(
      options.__unparsed__,
      '--exit-zero',
    );
    options.exitZero = unparsedExitZero ?? options.exitZero;

    const commandArgs = ['ruff', 'check']
      .concat(options.lintFilePatterns)
      .concat(options.__unparsed__);

    if (options.fix) {
      commandArgs.push('--fix');
    }

    if (options.exitZero) {
      commandArgs.push('--exit-zero');
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
