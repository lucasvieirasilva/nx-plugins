import { ExecutorContext } from '@nx/devkit';
import chalk from 'chalk';
import spawn from 'cross-spawn';
import { Logger } from '../utils/logger';
import { ExecutorSchema } from './schema';
import path from 'path';
import { existsSync, readdirSync, writeFileSync, removeSync } from 'fs-extra';
import { getProvider } from '../../provider';

const logger = new Logger();

export default async function executor(
  options: ExecutorSchema,
  context: ExecutorContext,
) {
  const workspaceRoot = context.root;
  process.chdir(workspaceRoot);
  const provider = await getProvider(
    workspaceRoot,
    undefined,
    undefined,
    context,
  );
  await provider.activateVenv(workspaceRoot, context);

  const projectConfig =
    context.projectsConfigurations.projects[context.projectName];
  const cwd = projectConfig.root;
  const requirementsTxt = path.join(cwd, 'requirements.txt');

  try {
    logger.info(
      chalk`\n  {bold Running serverless framework deploy on project {bgBlue  ${context.projectName} }...}\n`,
    );

    const distFolder = path.join(cwd, 'dist');
    if (!existsSync(distFolder)) {
      throw new Error(`dist folder does not exist: ${distFolder}`);
    }

    const whlFile = readdirSync(distFolder).find((file) =>
      file.endsWith('.whl'),
    );
    if (!whlFile) {
      throw new Error(`No .whl file found in dist folder: ${distFolder}`);
    }

    writeFileSync(requirementsTxt, `./dist/${whlFile}`);

    const executable = 'npx';
    const deployArgs = ['sls', 'package', '--stage', options.stage];
    const result = spawn.sync(executable, deployArgs, {
      cwd: cwd,
      shell: false,
      stdio: 'inherit',
    });

    if (result.status !== 0) {
      throw new Error(`Serverless package failed`);
    }

    return {
      success: true,
    };
  } catch (error) {
    logger.info(chalk`\n  {bgRed.bold  ERROR } ${error.message}\n`);
    return {
      success: false,
    };
  } finally {
    removeSync(requirementsTxt);
  }
}
