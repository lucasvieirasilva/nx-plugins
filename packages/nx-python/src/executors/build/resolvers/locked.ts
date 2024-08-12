import { PyprojectToml } from '../../../graph/dependency-graph';
import { parse } from '@iarna/toml';
import { readFileSync, existsSync } from 'fs-extra';
import path, { join, relative } from 'path';
import { PoetryLock, Dependency, PoetryLockPackage } from './types';
import { Logger } from '../../utils/logger';
import chalk from 'chalk';
import { parseToml, runPoetry } from '../../utils/poetry';
import uri2path from 'file-uri-to-path';
import { getLoggingTab, includeDependencyPackage } from './utils';
import { isWindows } from '../../utils/os';

export class LockedDependencyResolver {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  public resolve(
    root: string,
    buildFolderPath: string,
    buildTomlData: PyprojectToml,
    devDependencies: boolean,
    workspaceRoot: string,
  ): Dependency[] {
    this.logger.info(chalk`  Resolving dependencies...`);
    return this.resolveDependencies(
      devDependencies,
      root,
      buildFolderPath,
      buildTomlData,
      workspaceRoot,
    );
  }

  private resolveDependencies(
    devDependencies: boolean,
    root: string,
    buildFolderPath: string,
    buildTomlData: PyprojectToml,
    workspaceRoot: string,
    deps: Dependency[] = [],
    level = 1,
  ): Dependency[] {
    const tab = getLoggingTab(level);
    const requerimentsTxt = this.getProjectRequirementsTxt(
      devDependencies,
      buildTomlData,
      root,
      buildFolderPath,
    );

    const lockData = parse(
      readFileSync(join(root, 'poetry.lock')).toString('utf-8'),
    ) as PoetryLock;

    const requerimentsLines = requerimentsTxt.split('\n');
    for (const line of requerimentsLines) {
      if (line.trim()) {
        const dep = {} as Dependency;
        const elements = line.split(';');

        if (elements.length > 1) {
          dep.markers = elements[1].trim();
        }

        if (elements[0].includes('@') || elements[0].startsWith('-e file:')) {
          this.resolveSourceDependency(
            tab,
            elements,
            dep,
            lockData,
            workspaceRoot,
            buildFolderPath,
            buildTomlData,
            deps,
          );
          continue;
        }

        dep.name = elements[0].split('==')[0];
        dep.version = elements[0].split('==')[1];
        this.logger.info(
          chalk`${tab}• Adding {blue.bold ${dep.name}==${dep.version}} dependency`,
        );
        this.resolvePackageExtras(dep);

        const lockedPkg = this.getLockedPackage(lockData, dep.name);

        dep.optional = lockedPkg.optional;
        deps.push(dep);
      }
    }

    if (buildTomlData.tool.poetry.extras) {
      for (const extra in buildTomlData.tool.poetry.extras) {
        const originalExtraDeps = buildTomlData.tool.poetry.extras[extra];
        const lockedDeps = originalExtraDeps.map((dep) =>
          lockData.package.find((pkg) => pkg.name === dep),
        );
        const resolvedDeps = this.resolveExtrasLockedDependencyTree(
          lockData,
          lockedDeps,
          level,
        );

        this.logger.info(
          chalk`${tab}• Extra: {blue.bold ${extra}} - {blue.bold ${resolvedDeps.join(
            ', ',
          )}} Locked Dependencies`,
        );
        buildTomlData.tool.poetry.extras[extra] = resolvedDeps;
      }
    }

    return deps;
  }

  private getProjectRequirementsTxt(
    devDependencies: boolean,
    buildTomlData: PyprojectToml,
    root: string,
    buildFolderPath: string,
  ): string {
    const requerimentsTxtFilename = 'requirements.txt';
    const outputPath = join(buildFolderPath, requerimentsTxtFilename);

    const exportArgs = [
      'export',
      '--format',
      requerimentsTxtFilename,
      '--without-hashes',
      '--without-urls',
      '--output',
      join(buildFolderPath, requerimentsTxtFilename),
    ].concat(devDependencies ? ['--dev'] : []);

    const extras = this.getExtras(buildTomlData);
    if (extras.length > 0) {
      extras.forEach((extra) => {
        exportArgs.push('--extras');
        exportArgs.push(extra);
      });
    }

    runPoetry(exportArgs, { cwd: root, log: false });

    return readFileSync(outputPath, { encoding: 'utf-8' });
  }

  private resolveSourceDependency(
    tab: string,
    exportedLineElements: string[],
    dep: Dependency,
    lockData: PoetryLock,
    workspaceRoot: string,
    buildFolderPath: string,
    buildTomlData: PyprojectToml,
    deps: Dependency[],
  ) {
    const { packageName, location } =
      this.extractLocalPackageInfo(exportedLineElements);

    dep.name = packageName;
    this.resolvePackageExtras(dep);

    const lockedPkg = this.getLockedPackage(lockData, dep.name);

    switch (lockedPkg.source.type) {
      case 'directory':
        this.includeDirectoryDependency(
          location,
          workspaceRoot,
          tab,
          packageName,
          buildFolderPath,
          buildTomlData,
        );
        break;
      case 'git':
        this.includeGitDependency(tab, lockedPkg, dep, deps);
        break;
      default:
        throw new Error(`Unsupported source type: ${lockedPkg.source.type}`);
    }
  }

  private extractLocalPackageInfo(exportedLineElements: string[]) {
    if (exportedLineElements[0].startsWith('-e file:')) {
      const location = isWindows()
        ? exportedLineElements[0].substring(11).trim() // -e file:///C:/Users/
        : exportedLineElements[0].substring(10).trim(); // -e file:///Users/
      const pyprojectToml = path.join(location, 'pyproject.toml');
      if (!existsSync(pyprojectToml)) {
        throw new Error(
          chalk`pyproject.toml not found in {blue.bold ${location}}`,
        );
      }

      const pyproject = parseToml(pyprojectToml);
      return {
        packageName: pyproject.tool.poetry.name,
        location: `file://${location}`,
      };
    }

    const atPosition = exportedLineElements[0].indexOf('@');
    const packageName = exportedLineElements[0].substring(0, atPosition).trim();
    const location = exportedLineElements[0].substring(atPosition + 1).trim();
    return { packageName, location };
  }

  private resolvePackageExtras(dep: Dependency) {
    if (dep.name.indexOf('[') !== -1) {
      dep.extras = dep.name
        .substring(dep.name.indexOf('[') + 1, dep.name.lastIndexOf(']'))
        .split(',')
        .map((extraName) => extraName.trim());

      dep.name = dep.name.substring(0, dep.name.indexOf('['));
    }
  }

  private getLockedPackage(lockData: PoetryLock, packageName: string) {
    const lockedPkg = lockData.package.find(
      (pkg) => pkg.name.toLowerCase() === packageName.toLowerCase(),
    );
    if (!lockedPkg) {
      throw new Error(
        chalk`Package {blue.bold ${packageName.toLowerCase()}} not found in poetry.lock`,
      );
    }
    return lockedPkg;
  }

  private includeDirectoryDependency(
    localDepUrl: string,
    workspaceRoot: string,
    tab: string,
    packageName: string,
    buildFolderPath: string,
    buildTomlData: PyprojectToml,
  ) {
    const rootFolder = relative(workspaceRoot, uri2path(localDepUrl));
    const pyprojectToml = join(rootFolder, 'pyproject.toml');
    const tomlData = parse(
      readFileSync(pyprojectToml).toString('utf-8'),
    ) as PyprojectToml;
    this.logger.info(
      chalk`${tab}• Adding {blue.bold ${packageName}} local dependency`,
    );
    includeDependencyPackage(
      tomlData,
      rootFolder,
      buildFolderPath,
      buildTomlData,
    );
  }

  private includeGitDependency(
    tab: string,
    lockedPkg: PoetryLockPackage,
    dep: Dependency,
    deps: Dependency[],
  ) {
    dep.git = lockedPkg.source.url;
    dep.optional = lockedPkg.optional;

    if (lockedPkg.source.reference !== 'HEAD') {
      dep.rev = lockedPkg.source.reference;
    }

    this.logger.info(
      chalk`${tab}• Adding {blue.bold ${dep.name}==${dep.git}@${lockedPkg.source.reference}} dependency`,
    );

    deps.push(dep);
  }

  private resolveExtrasLockedDependencyTree(
    lockData: PoetryLock,
    deps: PoetryLockPackage[],
    level: number,
    resolvedDeps: string[] = [],
  ): string[] {
    const tab = getLoggingTab(level);
    for (const dep of deps) {
      this.logger.info(
        chalk`${tab}• Resolving dependency: {blue.bold ${dep.name}}`,
      );
      if (
        dep.source?.type !== 'directory' &&
        !resolvedDeps.includes(dep.name)
      ) {
        resolvedDeps.push(dep.name);
      }
      const pkgDeps = dep.dependencies ? Object.keys(dep.dependencies) : [];
      const optionalPkgDeps = pkgDeps
        .map((depName) =>
          lockData.package.find((pkg) => pkg.name === depName && pkg.optional),
        )
        .filter(
          (pkgDep) =>
            pkgDep !== undefined && !resolvedDeps.includes(pkgDep.name),
        );

      optionalPkgDeps.forEach((pkgDep) => resolvedDeps.push(pkgDep.name));
      if (optionalPkgDeps.length > 0) {
        this.logger.info(
          chalk`${tab}• Resolved Dependencies: {blue.bold ${optionalPkgDeps
            .map((pkgDep) => pkgDep.name)
            .join(' ')}}`,
        );
      }
      this.resolveExtrasLockedDependencyTree(
        lockData,
        optionalPkgDeps,
        level,
        resolvedDeps,
      );
    }

    return resolvedDeps;
  }

  private getExtras(buildTomlData: PyprojectToml) {
    if (buildTomlData.tool.poetry.extras) {
      return Object.keys(buildTomlData.tool.poetry.extras);
    }
    return [];
  }
}
