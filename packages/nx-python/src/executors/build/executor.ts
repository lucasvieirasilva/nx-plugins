import { ExecutorContext } from '@nrwl/devkit';
import { BuildExecutorSchema } from './schema';
import {
  readdirSync,
  copySync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
} from 'fs-extra';
import { join, relative } from 'path';
import { PyprojectToml, PyprojectTomlDependency } from '../../graph/dependency-graph';
import { parse, stringify } from '@iarna/toml';
import spawn from 'cross-spawn';
import { tmpdir } from 'os'
import { v4 as uuid } from 'uuid'
import chalk from 'chalk'
import { Logger } from '../utils/logger';
import uri2path from 'file-uri-to-path'

const logger = new Logger()

type Dependency = {
  name: string;
  version: string;
  markers?: string;
  optional: boolean;
  extras?: string[]
}

type PoetryLockPackage = {
  name: string
  version: string
  category: string
  optional: boolean
  dependencies?: {
    [key: string]: PyprojectTomlDependency
  }
  source?: {
    type: string
  }
}

type PoetryLock = {
  package: PoetryLockPackage[]
}

export default async function executor(
  options: BuildExecutorSchema,
  context: ExecutorContext
) {
  logger.setOptions(options)
  const workspaceRoot = context.root;
  process.chdir(workspaceRoot)
  try {
    logger.info(chalk`\n  {bold Building project {bgBlue  ${context.projectName} }...}\n`);

    const { root } = context.workspace.projects[context.projectName];

    const buildFolderPath = join(tmpdir(), 'nx-python', 'build', uuid());

    mkdirSync(buildFolderPath, { recursive: true });

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
    ) as PyprojectToml;

    logger.info(chalk`  Resolving dependencies...`)
    resolveLockedDependencies(root, buildFolderPath, buildTomlData, options.devDependencies, workspaceRoot);
    writeFileSync(buildPyProjectToml, stringify(buildTomlData));
    const distFolder = join(buildFolderPath, 'dist');

    rmSync(distFolder, { recursive: true, force: true });

    logger.info(chalk`  Generating sdist and wheel artifacts`)
    const executable = 'poetry'
    const buildArgs = ['build']
    const command = `${executable} ${buildArgs.join(' ')}`
    logger.info(chalk`  Running ${command}`)
    spawn.sync(executable, buildArgs, {
      cwd: buildFolderPath,
      shell: false,
      stdio: 'inherit'
    });

    rmSync(options.outputPath, { recursive: true, force: true });
    mkdirSync(options.outputPath, { recursive: true });
    logger.info(chalk`  Artifacts generated at {bold ${options.outputPath}} folder`)
    copySync(distFolder, options.outputPath);

    if (!options.keepBuildFolder) {
      rmSync(buildFolderPath, { recursive: true, force: true });
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

function resolveLockedDependencies(
  root: string,
  buildFolderPath: string,
  buildTomlData: PyprojectToml,
  devDependencies: boolean,
  workspaceRoot: string
) {
  const deps = resolveDependencies(devDependencies, root, buildFolderPath, buildTomlData, workspaceRoot);

  const pythonDependency = buildTomlData.tool.poetry.dependencies.python;

  buildTomlData.tool.poetry.dependencies = {};
  buildTomlData.tool.poetry.group = {
    dev: {
      dependencies: {}
    }
  };

  if (pythonDependency) {
    buildTomlData.tool.poetry.dependencies['python'] = pythonDependency;
  }

  for (const dep of deps) {
    const pyprojectDep = parseToPyprojectDependency(dep);
    buildTomlData.tool.poetry.dependencies[dep.name] = pyprojectDep
  }
}

function parseToPyprojectDependency(dep: Dependency): PyprojectTomlDependency {
  if (dep.markers || dep.optional || dep.extras) {
    return {
      version: dep.version,
      markers: dep.markers,
      optional: dep.optional,
      extras: dep.extras,
    };
  } else {
    return dep.version;
  }
}

function resolveDependencies(
  devDependencies: boolean,
  root: string,
  buildFolderPath: string,
  buildTomlData: PyprojectToml,
  workspaceRoot: string,
  deps: Dependency[] = [],
  level = 1,
): Dependency[] {
  const tab = getLoggingTab(level)
  const requerimentsTxt = getProjectRequirementsTxt(devDependencies, buildTomlData, root, buildFolderPath);

  const lockData = parse(
    readFileSync(join(root, 'poetry.lock')).toString('utf-8')
  ) as PoetryLock;

  const requerimentsLines = requerimentsTxt.split("\n");
  for (const line of requerimentsLines) {
    if (line.trim()) {
      const dep = {} as Dependency;
      const elements = line.split(";");
      if (elements[0].includes('@')) {
        const packageName = elements[0].split('@')[0].trim()
        const localDepUrl = elements[0].split('@')[1].trim()
        const rootFolder = relative(workspaceRoot, uri2path(localDepUrl))
        const pyprojectToml = join(rootFolder, 'pyproject.toml')
        const tomlData = parse(readFileSync(pyprojectToml).toString('utf-8')) as PyprojectToml;
        logger.info(chalk`${tab}• Adding {blue.bold ${packageName}} local dependency`)
        includeDependencyPackage(tomlData, rootFolder, buildFolderPath, buildTomlData)
        continue
      }

      dep.name = elements[0].split('==')[0];
      dep.version = elements[0].split('==')[1];
      logger.info(chalk`${tab}• Adding {blue.bold ${dep.name}==${dep.version}} dependency`)
      resolvePackageExtras(dep);

      if (elements.length > 1) {
        dep.markers = elements[1].trim();
      }

      const lockedPkg = lockData.package.find(pkg => pkg.name.toLowerCase() === dep.name.toLowerCase())
      if (!lockedPkg) {
        throw new Error(chalk`Package {blue.bold ${dep.name}} not found in poetry.lock`);
      }

      dep.optional = lockedPkg.optional;
      deps.push(dep);
    }
  }

  if (buildTomlData.tool.poetry.extras) {
    for (const extra in buildTomlData.tool.poetry.extras) {
      const originalExtraDeps = buildTomlData.tool.poetry.extras[extra]
      const lockedDeps = originalExtraDeps.map(dep => lockData.package.find(pkg => pkg.name === dep))
      const resolvedDeps = resolveExtrasLockedDependencyTree(lockData, lockedDeps, level)

      logger.info(chalk`${tab}• Extra: {blue.bold ${extra}} - {blue.bold ${resolvedDeps.join(', ')}} Locked Dependencies`)
      buildTomlData.tool.poetry.extras[extra] = resolvedDeps
    }
  }

  return deps;
}

function getProjectRequirementsTxt(
  devDependencies: boolean,
  buildTomlData: PyprojectToml,
  root: string,
  buildFolderPath: string
): string {
  const requerimentsTxtFilename = 'requirements.txt'
  const outputPath = join(buildFolderPath, requerimentsTxtFilename)

  const exportArgs = [
    'export',
    '--format',
    requerimentsTxtFilename,
    '--without-hashes',
    '--without-urls',
    '--output',
    join(buildFolderPath, requerimentsTxtFilename),
  ].concat(devDependencies ? ['--dev'] : []);

  const extras = getExtras(buildTomlData);
  if (extras.length > 0) {
    extras.forEach(extra => {
      exportArgs.push('--extras');
      exportArgs.push(extra);
    });
  }

  spawn.sync(
    'poetry',
    exportArgs,
    {
      cwd: root,
      shell: false,
      stdio: 'inherit'
    }
  );

  return readFileSync(outputPath, { encoding: 'utf-8' })
}

function resolvePackageExtras(dep: Dependency) {
  if (dep.name.indexOf('[') !== -1) {
    dep.extras = dep.name.substring(
      dep.name.indexOf("[") + 1,
      dep.name.lastIndexOf("]")
    ).split(',').map(extraName => extraName.trim());

    dep.name = dep.name.substring(0, dep.name.indexOf("["));
  }
}

function getLoggingTab(level: number): string {
  return "    ".repeat(level);
}

function resolveExtrasLockedDependencyTree(
  lockData: PoetryLock,
  deps: PoetryLockPackage[],
  level: number,
  resolvedDeps: string[] = [],
): string[] {
  const tab = getLoggingTab(level)
  for (const dep of deps) {
    logger.info(chalk`${tab}• Resolving dependency: {blue.bold ${dep.name}}`)
    if (dep.source?.type !== 'directory' && !resolvedDeps.includes(dep.name)) {
      resolvedDeps.push(dep.name)
    }
    const pkgDeps = dep.dependencies ? Object.keys(dep.dependencies) : []
    const optionalPkgDeps = pkgDeps
      .map(depName => lockData.package.find(pkg => pkg.name === depName && pkg.optional))
      .filter(pkgDep => pkgDep !== undefined && !resolvedDeps.includes(pkgDep.name))

    optionalPkgDeps.forEach(pkgDep => (resolvedDeps.push(pkgDep.name)))
    if (optionalPkgDeps.length > 0) {
      logger.info(chalk`${tab}• Resolved Dependencies: {blue.bold ${optionalPkgDeps.map(pkgDep => pkgDep.name).join(' ')}}`)
    }
    resolveExtrasLockedDependencyTree(lockData, optionalPkgDeps, level, resolvedDeps)
  }

  return resolvedDeps
}

function getExtras(buildTomlData: PyprojectToml) {
  if (buildTomlData.tool.poetry.extras) {
    return Object.keys(buildTomlData.tool.poetry.extras);
  }
  return [];
}

function includeDependencyPackage(
  tomlData: PyprojectToml,
  root: string,
  buildFolderPath: string,
  buildTomlData: PyprojectToml
) {
  for (const pkg of tomlData.tool.poetry.packages) {
    const pkgFolder = join(root, pkg.include);
    const buildPackageFolder = join(buildFolderPath, pkg.include);

    copySync(pkgFolder, buildPackageFolder, { recursive: true });

    buildTomlData.tool.poetry.packages.push({
      include: pkg.include,
    });
  }

  if (tomlData.tool.poetry.plugins) {
    if (!buildTomlData.tool.poetry.plugins) {
      buildTomlData.tool.poetry.plugins = {}
    }

    for (const pluginName in tomlData.tool.poetry.plugins) {
      buildTomlData.tool.poetry.plugins[pluginName] = tomlData.tool.poetry.plugins[pluginName]
    }
  }
}
