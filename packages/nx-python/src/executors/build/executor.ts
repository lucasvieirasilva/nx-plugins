import { ExecutorContext } from '@nx/devkit';
import { BuildExecutorSchema } from './schema';
import {
  readdirSync,
  copySync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  removeSync,
} from 'fs-extra';
import { join } from 'path';
import {
  PyprojectToml,
  PyprojectTomlDependency,
} from '../../graph/dependency-graph';
import { parse, stringify } from '@iarna/toml';
import { tmpdir } from 'os';
import { v4 as uuid } from 'uuid';
import chalk from 'chalk';
import { Logger } from '../utils/logger';
import {
  activateVenv,
  checkPoetryExecutable,
  runPoetry,
} from '../utils/poetry';
import {
  LockedDependencyResolver,
  ProjectDependencyResolver,
} from './resolvers';
import { Dependency } from './resolvers/types';

const logger = new Logger();

export default async function executor(
  options: BuildExecutorSchema,
  context: ExecutorContext,
) {
  logger.setOptions(options);
  const workspaceRoot = context.root;
  process.chdir(workspaceRoot);
  try {
    activateVenv(workspaceRoot);
    await checkPoetryExecutable();
    if (
      options.lockedVersions === true &&
      options.bundleLocalDependencies === false
    ) {
      throw new Error(
        'Not supported operations, you cannot use lockedVersions without bundleLocalDependencies',
      );
    }

    logger.info(
      chalk`\n  {bold Building project {bgBlue  ${context.projectName} }...}\n`,
    );

    const { root } = context.workspace.projects[context.projectName];

    const buildFolderPath = join(tmpdir(), 'nx-python', 'build', uuid());

    mkdirSync(buildFolderPath, { recursive: true });

    logger.info(chalk`  Copying project files to a temporary folder`);
    readdirSync(root).forEach((file) => {
      if (!options.ignorePaths.includes(file)) {
        const source = join(root, file);
        const target = join(buildFolderPath, file);
        copySync(source, target);
      }
    });

    const buildPyProjectToml = join(buildFolderPath, 'pyproject.toml');

    const buildTomlData = parse(
      readFileSync(buildPyProjectToml).toString('utf-8'),
    ) as PyprojectToml;

    const deps = resolveDependencies(
      options,
      root,
      buildFolderPath,
      buildTomlData,
      workspaceRoot,
      context,
    );

    const pythonDependency = buildTomlData.tool.poetry.dependencies.python;

    buildTomlData.tool.poetry.dependencies = {};
    buildTomlData.tool.poetry.group = {
      dev: {
        dependencies: {},
      },
    };

    if (pythonDependency) {
      buildTomlData.tool.poetry.dependencies['python'] = pythonDependency;
    }

    for (const dep of deps) {
      const pyprojectDep = parseToPyprojectDependency(dep);
      buildTomlData.tool.poetry.dependencies[dep.name] = pyprojectDep;
    }

    writeFileSync(buildPyProjectToml, stringify(buildTomlData));
    const distFolder = join(buildFolderPath, 'dist');

    removeSync(distFolder);

    logger.info(chalk`  Generating sdist and wheel artifacts`);
    const buildArgs = ['build'];
    runPoetry(buildArgs, { cwd: buildFolderPath });

    removeSync(options.outputPath);
    mkdirSync(options.outputPath, { recursive: true });
    logger.info(
      chalk`  Artifacts generated at {bold ${options.outputPath}} folder`,
    );
    copySync(distFolder, options.outputPath);

    if (!options.keepBuildFolder) {
      removeSync(buildFolderPath);
    }

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

function parseToPyprojectDependency(dep: Dependency): PyprojectTomlDependency {
  if (dep.markers || dep.optional || dep.extras || dep.git || dep.source) {
    return {
      version: dep.version,
      markers: dep.markers,
      optional: dep.optional,
      extras: dep.extras,
      git: dep.git,
      rev: dep.rev,
      source: dep.source,
    };
  } else {
    return dep.version;
  }
}

function resolveDependencies(
  options: BuildExecutorSchema,
  root: string,
  buildFolderPath: string,
  buildTomlData: PyprojectToml,
  workspaceRoot: string,
  context: ExecutorContext,
) {
  if (options.lockedVersions) {
    return new LockedDependencyResolver(logger).resolve(
      root,
      buildFolderPath,
      buildTomlData,
      options.devDependencies,
      workspaceRoot,
    );
  } else {
    return new ProjectDependencyResolver(logger, options, context).resolve(
      root,
      buildFolderPath,
      buildTomlData,
    );
  }
}
