import chalk from 'chalk';
import path, { join, relative, resolve } from 'path';
import { existsSync } from 'fs-extra';
import { UVLockfile, UVPyprojectToml, UVPyprojectTomlIndex } from '../../types';
import { Logger } from '../../../../executors/utils/logger';
import { getLoggingTab, getPyprojectData } from '../../../utils';
import { getUvLockfile } from '../../utils';
import {
  extractExtraFromDependencyName,
  includeDependencyPackage,
  normalizeDependencyName,
} from './utils';
import { BuildExecutorSchema } from '../../../../executors/build/schema';
import { ExecutorContext } from '@nx/devkit';
import { createHash } from 'crypto';

/**
 * Resolves project dependencies for UV package manager when lockedVersion is false.
 *
 * This resolver handles complex dependency scenarios including:
 * - Local workspace dependencies with path references
 * - Optional dependencies (extras) merging and promotion
 * - Multi-level dependency resolution
 * - Bundle vs publish mode handling
 *
 * The resolver processes dependencies recursively, merging optional dependencies
 * from local packages into the target package's metadata, ensuring that when
 * a local dependency is bundled, its optional dependencies are properly included
 * in the final wheel metadata.
 */
export class ProjectDependencyResolver {
  private rootUvLock: UVLockfile | null = null;

  constructor(
    private readonly logger: Logger,
    private readonly options: BuildExecutorSchema,
    private readonly context: ExecutorContext,
    private readonly isWorkspace: boolean,
  ) {}

  /**
   * Applies dependency resolution to the pyproject.toml configuration.
   *
   * This is the main entry point that processes all dependencies in the project,
   * including local workspace dependencies and their optional dependencies.
   *
   * @param projectRoot - The root path of the current project
   * @param buildFolderPath - The build output directory path
   * @param buildTomlData - The pyproject.toml configuration to modify
   * @param workspaceRoot - The workspace root path
   * @returns Modified pyproject.toml configuration with resolved dependencies
   */
  apply(
    projectRoot: string,
    buildFolderPath: string,
    buildTomlData: UVPyprojectToml,
    workspaceRoot: string,
  ): UVPyprojectToml {
    this.logger.info(chalk`  Resolving dependencies...`);

    return this.updatePyproject(
      projectRoot,
      buildFolderPath,
      buildTomlData,
      workspaceRoot,
    );
  }

  /**
   * Recursively updates the pyproject.toml with resolved dependencies.
   *
   * This method follows a "do one thing well" design principle by processing
   * only ONE level of local dependencies at a time. This approach prevents
   * complexity explosion and makes the extras/optional dependency merging
   * logic manageable.
   *
   * **Design Philosophy:**
   * - Each call processes exactly one level of local dependencies
   * - Results are accumulated incrementally: A -> A+B -> A+B+C -> A+B+C+D
   * - Complex logic (extras merging, optional promotion) is handled one level at a time
   * - Each recursive call only needs to worry about the next level, not the entire tree
   *
   * **Benefits:**
   * - Predictable and debuggable: each call has a single responsibility
   * - Memory efficient: only loads one level of dependencies at a time
   * - Error isolation: failures are contained to specific levels
   * - Testable: each level can be tested independently
   *
   * This method handles the core dependency resolution logic:
   * 1. Processes all dependencies (main and optional)
   * 2. Resolves local workspace dependencies
   * 3. Merges optional dependencies from local packages
   * 4. Promotes optional dependencies to main dependencies when needed
   * 5. Handles multi-level dependency resolution
   *
   * @param projectRoot - The root path of the current project
   * @param buildFolderPath - The build output directory path
   * @param pyproject - The pyproject.toml configuration to modify
   * @param workspaceRoot - The workspace root path
   * @param loggedDependencies - Array of already logged dependencies to avoid duplicates
   * @returns Modified pyproject.toml configuration
   */
  private updatePyproject(
    projectRoot: string,
    buildFolderPath: string,
    pyproject: UVPyprojectToml,
    workspaceRoot: string,
    loggedDependencies: string[] = [],
  ): UVPyprojectToml {
    const tab = getLoggingTab(1);
    let hasMoreLevels = false;

    // Step 1: Extract all dependencies from the pyproject.toml
    // This includes both main dependencies and optional dependencies (extras)
    const dependencies = this.getProjectDependencies(pyproject);

    // Step 2: Process each dependency in the project
    for (const [group, dependencyName] of dependencies) {
      // Normalize the dependency name to get the base package name without version/extras
      const normalizedName = normalizeDependencyName(dependencyName);

      // Find the actual dependency object from the appropriate group
      const dependency =
        group === '__main__'
          ? pyproject.project.dependencies.find(
              (d) => normalizeDependencyName(d) === normalizedName,
            )
          : pyproject.project['optional-dependencies']?.[group]?.find(
              (d) => normalizeDependencyName(d) === normalizedName,
            );

      // Extract any extras specified for this dependency (e.g., "requests[security]")
      const extras = extractExtraFromDependencyName(dependency);

      if (!normalizedName) {
        continue;
      }

      // Step 3: Check if this is a local workspace dependency
      if (pyproject.tool?.uv?.sources?.[normalizedName]) {
        // Get the absolute path to the local dependency
        const dependencyPath = this.getDependencyPath(
          workspaceRoot,
          normalizedName,
          projectRoot,
          pyproject.tool.uv.sources[normalizedName].path,
        );

        if (!dependencyPath) {
          continue;
        }

        // Verify the local dependency has a pyproject.toml file
        const dependencyPyprojectPath = path.join(
          dependencyPath,
          'pyproject.toml',
        );

        if (!existsSync(dependencyPyprojectPath)) {
          this.logger.info(
            chalk`${tab}• Skipping local dependency {blue.bold ${dependency}} as pyproject.toml not found`,
          );
          continue;
        }

        // Step 4: Load the local dependency's pyproject.toml configuration
        const dependencyPyproject = getPyprojectData<UVPyprojectToml>(
          dependencyPyprojectPath,
        );

        // Get the Nx project configuration for the local dependency
        const config = this.getProjectConfig(dependencyPath);
        const targetOptions: BuildExecutorSchema | undefined =
          config.targets?.build?.options;

        // Check if the local dependency should be published (default: true)
        const publisable = targetOptions?.publish ?? true;

        // Step 5: Handle bundle mode - include local dependency in the build
        if (
          this.options.bundleLocalDependencies === true ||
          publisable === false
        ) {
          // Log the dependency being added (avoid duplicates)
          if (!loggedDependencies.includes(dependency)) {
            this.logger.info(
              chalk`${tab}• Adding {blue.bold ${dependency}} local dependency`,
            );
            loggedDependencies.push(dependency);
          }

          // Step 5a: Include the local dependency's package in the build
          // This copies the source code and updates the pyproject.toml structure
          includeDependencyPackage(
            dependencyPyproject,
            dependencyPath,
            buildFolderPath,
            pyproject,
            workspaceRoot,
          );

          // Step 5b: Get all dependencies from the local dependency
          const depDependencies =
            this.getProjectDependencies(dependencyPyproject);

          // Step 5c: Remove the local dependency from the target pyproject
          // since it's now included in the build
          this.removeDependency(group, dependency, pyproject);
          delete pyproject.tool.uv.sources[normalizedName];

          // Step 5d: Merge optional dependencies (extras) from the local dependency
          const dependencyPyProjectExtras =
            dependencyPyproject.project?.['optional-dependencies'] ?? {};
          const targetExtras =
            pyproject.project?.['optional-dependencies'] ?? {};

          // Merge the extras from the local sub dependency to the target pyproject
          if (dependencyPyproject.project?.['optional-dependencies']) {
            for (const [extraName, extraData] of Object.entries(
              dependencyPyProjectExtras,
            )) {
              if (targetExtras[extraName]) {
                // If the extra already exists, merge the dependencies
                for (const dep of extraData) {
                  const normalizedDep = normalizeDependencyName(dep);
                  if (
                    normalizedDep &&
                    !targetExtras[extraName].some(
                      (d) => normalizeDependencyName(d) === normalizedDep,
                    )
                  ) {
                    targetExtras[extraName].push(dep);
                  }
                }
              } else {
                // If the extra doesn't exist, create it
                targetExtras[extraName] = extraData;
              }
            }

            pyproject.project['optional-dependencies'] = targetExtras;
          }

          // Step 5e: Process each dependency from the local dependency
          for (const [depGroup, depName] of depDependencies) {
            let depGroupToUse = depGroup;
            const normalizedDep = normalizeDependencyName(depName);
            const depExtras = extractExtraFromDependencyName(depName);

            // Step 5f: Handle extras promotion - move optional dependencies to main
            if (extras.length && group === '__main__') {
              for (const extraName of extras) {
                const libsToSetToMain =
                  dependencyPyProjectExtras[extraName] ?? [];

                /**
                 * Move the dependency from the optional block to the main
                 * dependencies block when the dependency is optional on the
                 * local sub dependency, but it is required by the target
                 * dependency via an extra.
                 *
                 * Example:
                 *
                 * Target pyproject.toml:
                 *
                 * [project]
                 * include = "app"
                 * dependencies = [
                 *  "lib[color]"
                 * ]
                 *
                 * [tool.uv.sources]
                 * lib = { path = "libs/lib" }
                 *
                 * Sub dependency pyproject.toml:
                 *
                 * [project.optional-dependencies]
                 * color = [
                 *  "colored>=2.3.0"
                 * ]
                 * json = [
                 *  "python-json-logger>=2.0.4"
                 * ]
                 *
                 *
                 * This will result in the following pyproject.toml:
                 *
                 * [project]
                 * dependencies = [
                 *  "colored>=2.3.0"
                 * ]
                 *
                 * [project.optional-dependencies]
                 * json = [
                 *  "python-json-logger>=2.0.4"
                 * ]
                 */
                if (
                  libsToSetToMain.some(
                    (lib) => normalizeDependencyName(lib) === normalizedDep,
                  )
                ) {
                  // Promote this dependency to main dependencies
                  depGroupToUse = '__main__';

                  /**
                   * Remove the dependency from the optional dependencies group
                   * when changing the dependency from optional to main.
                   */
                  if (
                    pyproject.project?.['optional-dependencies']?.[extraName]
                  ) {
                    pyproject.project['optional-dependencies'][extraName] =
                      pyproject.project['optional-dependencies'][
                        extraName
                      ].filter(
                        (d) => normalizeDependencyName(d) !== normalizedDep,
                      );

                    // If the optional dependencies group is empty, remove it
                    if (
                      pyproject.project['optional-dependencies'][extraName]
                        .length === 0
                    ) {
                      delete pyproject.project['optional-dependencies'][
                        extraName
                      ];
                    }
                  }
                }
              }
            }

            // Step 5g: Check if this dependency is also a local dependency
            if (
              dependencyPyproject.tool?.uv?.sources?.[normalizedDep]?.path ||
              dependencyPyproject.tool?.uv?.sources?.[normalizedDep]?.workspace
            ) {
              // This is a multi-level local dependency - mark for recursive processing
              hasMoreLevels = true;

              // Merge extras from existing dependency with new extras
              const existingDepExtras = extractExtraFromDependencyName(
                depGroupToUse === '__main__'
                  ? pyproject.project.dependencies.find(
                      (d) => normalizeDependencyName(d) === normalizedDep,
                    )
                  : pyproject.project?.['optional-dependencies']?.[
                      depGroupToUse
                    ]?.find(
                      (d) => normalizeDependencyName(d) === normalizedDep,
                    ),
              );

              const newExtras = [
                ...(existingDepExtras ?? []),
                ...(depExtras ?? []),
              ];

              // Add the dependency with merged extras
              this.appendDependency(
                pyproject,
                targetOptions,
                depGroupToUse,
                newExtras.length
                  ? `${normalizedDep}[${newExtras.join(',')}]`
                  : depName,
                true,
              );

              // Copy the source configuration for the nested local dependency
              pyproject.tool.uv.sources ??= {};
              pyproject.tool.uv.sources[normalizedDep] = {
                ...dependencyPyproject.tool.uv.sources[normalizedDep],
              };

              // Update the path to be relative to the current project
              if (pyproject.tool.uv.sources[normalizedDep].path) {
                pyproject.tool.uv.sources[normalizedDep].path = relative(
                  join(process.cwd(), projectRoot),
                  resolve(
                    dependencyPath,
                    pyproject.tool.uv.sources[normalizedDep].path,
                  ),
                );
              }
            } else {
              // Step 5h: This is a regular external dependency - add it directly
              this.appendDependency(
                pyproject,
                targetOptions,
                depGroupToUse,
                depName,
              );

              if (!loggedDependencies.includes(depName)) {
                this.logger.info(
                  chalk`${tab}• Adding {blue.bold ${depName}} dependency`,
                );
                loggedDependencies.push(depName);
              }
            }
          }
        } else {
          // Step 6: Handle publish mode - reference local dependency by version
          const index = this.addIndex(pyproject, targetOptions);
          const depName = `${dependency}==${dependencyPyproject.project.version}`;
          this.appendDependency(pyproject, targetOptions, group, depName, true);

          // Update the source configuration
          if (pyproject.tool?.uv?.sources?.[normalizedName] && !index) {
            delete pyproject.tool.uv.sources[normalizedName];
          } else {
            pyproject.tool ??= { uv: {} };
            pyproject.tool.uv ??= { sources: {} };
            pyproject.tool.uv.sources ??= {};
            pyproject.tool.uv.sources[normalizedName] = {
              index,
            };
          }

          if (!loggedDependencies.includes(depName)) {
            this.logger.info(
              chalk`${tab}• Adding {blue.bold ${depName}} local dependency`,
            );
            loggedDependencies.push(depName);
          }
        }
      } else {
        // Step 7: This is an external dependency - just log it
        if (!loggedDependencies.includes(dependency)) {
          this.logger.info(
            chalk`${tab}• Adding {blue.bold ${dependency}} dependency`,
          );
          loggedDependencies.push(dependency);
        }
      }
    }

    // Step 8: Clean up optional dependencies that are no longer optional
    // Remove extras that are not optional anymore
    for (const [extraName, extraData] of Object.entries(
      pyproject.project['optional-dependencies'] ?? {},
    )) {
      pyproject.project['optional-dependencies'][extraName] = extraData.filter(
        (optionalDep) =>
          !pyproject.project.dependencies
            .map((dep) => normalizeDependencyName(dep))
            .includes(normalizeDependencyName(optionalDep)),
      );

      // Remove empty optional dependency groups
      if (!pyproject.project['optional-dependencies'][extraName]?.length) {
        delete pyproject.project['optional-dependencies'][extraName];
      }
    }

    // Step 9: Recursive processing for multi-level dependencies
    if (hasMoreLevels) {
      this.updatePyproject(
        projectRoot,
        buildFolderPath,
        pyproject,
        workspaceRoot,
        loggedDependencies,
      );
    }

    return pyproject;
  }

  /**
   * Removes a dependency from the specified group in pyproject.toml.
   *
   * @param group - The dependency group ('__main__' for main dependencies, or extra name)
   * @param dependency - The dependency string to remove
   * @param pyproject - The pyproject.toml configuration to modify
   */
  private removeDependency(
    group: string,
    dependency: string,
    pyproject: UVPyprojectToml,
  ) {
    if (group === '__main__') {
      pyproject.project.dependencies = pyproject.project.dependencies.filter(
        (dep) => dep !== dependency,
      );
    } else {
      pyproject.project['optional-dependencies'] ??= {};
      pyproject.project['optional-dependencies'][group] = pyproject.project[
        'optional-dependencies'
      ]?.[group]?.filter((dep) => dep !== dependency);
    }
  }

  /**
   * Appends a dependency to the specified group in pyproject.toml.
   *
   * Handles both main dependencies and optional dependencies, with support
   * for force updates and index management.
   *
   * @param pyproject - The pyproject.toml configuration to modify
   * @param targetOptions - Build options for the target project
   * @param group - The dependency group ('__main__' for main dependencies, or extra name)
   * @param dependency - The dependency string to add
   * @param force - Whether to force update existing dependencies
   */
  private appendDependency(
    pyproject: UVPyprojectToml,
    targetOptions: BuildExecutorSchema,
    group: string,
    dependency: string,
    force = false,
  ) {
    const index = this.addIndex(pyproject, targetOptions);
    const normalizedName = normalizeDependencyName(dependency);
    if (group === '__main__') {
      const existingIndex = pyproject.project.dependencies.findIndex(
        (dep) => normalizeDependencyName(dep) === normalizedName,
      );

      if (existingIndex !== -1 && !force) {
        return;
      }

      if (existingIndex !== -1) {
        pyproject.project.dependencies[existingIndex] = dependency;
      } else {
        pyproject.project.dependencies.push(dependency);
      }
    } else {
      pyproject.project['optional-dependencies'] ??= {};
      pyproject.project['optional-dependencies'][group] ??= [];

      const existingIndex = pyproject.project['optional-dependencies'][
        group
      ].findIndex((dep) => normalizeDependencyName(dep) === normalizedName);

      if (existingIndex !== -1 && !force) {
        return;
      }

      if (existingIndex !== -1) {
        pyproject.project['optional-dependencies'][group][existingIndex] =
          dependency;
      } else {
        pyproject.project['optional-dependencies'][group].push(dependency);
      }
    }

    if (index) {
      pyproject.tool ??= { uv: {} };
      pyproject.tool.uv ??= { sources: {} };
      pyproject.tool.uv.sources ??= {};
      pyproject.tool.uv.sources[normalizedName] = {
        index,
      };
    }
  }

  /**
   * Gets all dependencies from the pyproject.toml as a flat array.
   *
   * Returns both main dependencies and optional dependencies in the format:
   * [['__main__', 'dependency1'], ['extra1', 'dependency2'], ...]
   *
   * @param pyproject - The pyproject.toml configuration to extract dependencies from
   * @returns Array of [group, dependency] pairs
   */
  private getProjectDependencies(pyproject: UVPyprojectToml): string[][] {
    return [
      ...pyproject.project.dependencies.map((dep) => ['__main__', dep]),
      ...Object.entries(
        pyproject.project['optional-dependencies'] ?? {},
      ).reduce((acc, [extra, deps]) => {
        for (const dep of deps) {
          acc.push([extra, dep]);
        }
        return acc;
      }, [] as string[][]),
    ];
  }

  /**
   * Gets the absolute path to a local dependency.
   *
   * Handles both workspace mode (using uv.lock) and relative path mode.
   *
   * @param workspaceRoot - The workspace root path
   * @param dependency - The dependency name
   * @param projectRoot - The current project root
   * @param relativePath - Optional relative path from pyproject.toml
   * @returns The absolute path to the dependency, or undefined if not found
   */
  private getDependencyPath(
    workspaceRoot: string,
    dependency: string,
    projectRoot: string,
    relativePath?: string,
  ) {
    if (this.isWorkspace) {
      if (!this.rootUvLock) {
        this.rootUvLock = getUvLockfile(path.join(workspaceRoot, 'uv.lock'));
      }
      return this.rootUvLock.package[dependency]?.source?.editable;
    } else if (relativePath) {
      return path.relative(
        process.cwd(),
        path.resolve(projectRoot, relativePath),
      );
    }

    return undefined;
  }

  /**
   * Adds a custom index to the pyproject.toml if specified in build options.
   *
   * @param buildTomlData - The pyproject.toml configuration to modify
   * @param targetOptions - Build options that may contain custom source URL
   * @returns The name of the added index, or undefined if no custom source
   */
  private addIndex(
    buildTomlData: UVPyprojectToml,
    targetOptions: BuildExecutorSchema,
  ): string | undefined {
    if (!targetOptions?.customSourceUrl) return undefined;

    const [newIndexes, newIndexName] = this.resolveDuplicateIndexes(
      buildTomlData.tool.uv.index,
      {
        name: targetOptions.customSourceName,
        url: targetOptions.customSourceUrl,
      },
    );

    buildTomlData.tool.uv.index = newIndexes;

    return newIndexName;
  }

  /**
   * Gets the Nx project configuration for a given root path.
   *
   * @param root - The project root path to find configuration for
   * @returns The Nx project configuration
   * @throws Error if project configuration is not found
   */
  private getProjectConfig(root: string) {
    for (const [, config] of Object.entries(
      this.context.projectsConfigurations.projects,
    )) {
      if (path.normalize(config.root) === path.normalize(root)) {
        return config;
      }
    }

    throw new Error(`Could not find project config for ${root}`);
  }

  /**
   * Resolves duplicate indexes by creating unique names with MD5 hashes.
   *
   * When multiple indexes have the same name but different URLs, this method
   * creates a new unique name by appending an MD5 hash of the URL.
   *
   * @param indexes - Existing indexes array
   * @param newIndex - The new index to add
   * @returns Tuple of [updated indexes array, final index name]
   */
  private resolveDuplicateIndexes = (
    indexes: UVPyprojectTomlIndex[],
    { name, url }: UVPyprojectTomlIndex,
  ): [UVPyprojectTomlIndex[], string] => {
    if (!indexes) {
      return [[{ name, url }], name];
    }

    const existing = indexes.find((s) => s.name === name);

    if (existing) {
      if (existing.url === url) {
        return [indexes, name];
      }

      const hash = createHash('md5').update(url).digest('hex');
      const newName = `${name}-${hash}`;

      this.logger.info(
        chalk`  Duplicate index for {blue.bold ${name}} renamed to ${newName}`,
      );

      if (indexes.find((s) => s.name === newName)) {
        return [indexes, newName];
      }

      return [[...indexes, { name: newName, url }], newName];
    }

    return [[...indexes, { name, url }], name];
  };
}
