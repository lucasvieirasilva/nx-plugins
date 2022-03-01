import { ExecutorContext } from '@nrwl/devkit';
import { BuildExecutorSchema } from './schema';
import {
  readdirSync,
  existsSync,
  rmdirSync,
  copySync,
  readFileSync,
  writeFileSync,
  mkdirsSync,
} from 'fs-extra';
import { join } from 'path';
import { getDependencies } from '../../graph/dependency-graph';
import { parse, stringify } from '@iarna/toml';
import { execSync } from 'child_process';
import { tmpdir } from 'os'
import { v4 as uuid } from 'uuid'
import chalk from 'chalk'
import { Logger } from '../utils/logger';

const logger = new Logger()

export default async function run(
  options: BuildExecutorSchema,
  context: ExecutorContext
) {
  logger.setOptions(options)
  try {
    logger.info(chalk`\n  {bold Building project {bgBlue  ${context.projectName} }...}\n`);

    const { root } = context.workspace.projects[context.projectName];

    const buildFolderPath = join(tmpdir(), 'nx-python', 'build', uuid());

    mkdirsSync(buildFolderPath);

    logger.info(chalk`  Copying project files to a temporary folder`)
    readdirSync(root).forEach((file) => {
      if (!options.ignorePaths.includes(file)) {
        const source = join(root, file);
        const target = join(buildFolderPath, file);
        copySync(source, target, {
          recursive: true,
        });
      }
    });

    const buildPyProjectToml = join(buildFolderPath, 'pyproject.toml');

    const buildTomlData = parse(
      readFileSync(buildPyProjectToml).toString('utf-8')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as any;

    logger.info(chalk`  Resolving {blue.bold poetry.lock} dependencies...`)
    resolveLockDependencies(root, options, buildTomlData);

    logger.info(chalk`  Resolving workspace dependencies...`)
    const deps = getDependencies(context.projectName, context.workspace);

    buildDependencies(
      options,
      context,
      deps,
      buildFolderPath,
      buildPyProjectToml,
      buildTomlData
    );

    writeFileSync(buildPyProjectToml, stringify(buildTomlData));

    const distFolder = join(buildFolderPath, 'dist');

    rmdirSync(distFolder, { recursive: true });

    logger.info(chalk`  Generating sdist and wheel artifacts`)
    const command = 'poetry build'
    logger.info(chalk`  Running ${command}`)
    execSync(command, {
      cwd: buildFolderPath,
      stdio: 'inherit'
    });

    rmdirSync(options.outputPath, { recursive: true });
    mkdirsSync(options.outputPath);
    logger.info(chalk`  Artifacts generated at {bold ${options.outputPath}} folder`)
    copySync(distFolder, options.outputPath);

    if (!options.keepBuildFolder) {
      rmdirSync(buildFolderPath, { recursive: true });
    }

    return {
      success: true,
    };
  } catch (error) {
    logger.info(chalk`\n  {bgRed.bold  ERROR } ${error.message}\n`)
    return {
      success: false,
    };
  }
}

function resolveLockDependencies(
  root: string,
  options: BuildExecutorSchema,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildTomlData: any
) {
  const poetryLockPath = join(root, 'poetry.lock');

  if (!existsSync(poetryLockPath)) {
    throw new Error(chalk`File {bold ${poetryLockPath}} not found`);
  }

  const lockData = parse(
    readFileSync(poetryLockPath).toString('utf-8')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any;

  const pythonDependency = buildTomlData.tool.poetry.dependencies.python;

  buildTomlData.tool.poetry.dependencies = {};

  if (pythonDependency) {
    buildTomlData.tool.poetry.dependencies['python'] = pythonDependency;
  }

  for (const pkg of lockData.package) {
    if (pkg.category === 'main') {
      logger.info(chalk`    • Adding {blue.bold ${pkg.name}} dependency`)

      if (!pkg.source || (pkg.source && pkg.source.type !== 'directory')) {
        buildTomlData.tool.poetry.dependencies[pkg.name] = pkg.version;
      }
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildDependencies(
  options: BuildExecutorSchema,
  context: ExecutorContext,
  deps: string[],
  buildFolderPath: string,
  buildPyProjectToml: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildTomlData: any,
  level = 1
) {
  for (const dep of deps) {
    const tab = "    ".repeat(level)
    logger.info(chalk`${tab}• Adding {blue.bold ${dep}} dependency`)
    const project = context.workspace.projects[dep];
    const pyprojectToml = join(project.root, 'pyproject.toml');

    const tomlData = parse(
      readFileSync(pyprojectToml).toString('utf-8')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as any;

    includeDependencyPackage(
      tomlData,
      project,
      buildFolderPath,
      options,
      buildPyProjectToml,
      buildTomlData
    );

    const dependencyRepoDependencies = getDependencies(dep, context.workspace);

    buildDependencies(
      options,
      context,
      dependencyRepoDependencies,
      buildFolderPath,
      buildPyProjectToml,
      buildTomlData,
      level+1
    );
  }
}

function includeDependencyPackage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tomlData: any,
  project,
  buildFolderPath: string,
  options: BuildExecutorSchema,
  buildPyProjectToml: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildTomlData: any
) {
  for (const pkg of tomlData.tool.poetry.packages) {
    const pkgFolder = join(project.root, pkg.include);
    const buildPackageFolder = join(buildFolderPath, pkg.include);

    copySync(pkgFolder, buildPackageFolder, { recursive: true });

    buildTomlData.tool.poetry.packages.push({
      include: pkg.include,
    });
  }
}
