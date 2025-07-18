import chalk from 'chalk';
import { join, normalize, relative, resolve } from 'path';
import { readFileSync } from 'fs-extra';
import { parse } from '@iarna/toml';
import { includeDependencyPackage } from './utils';
import { ExecutorContext } from '@nx/devkit';
import { createHash } from 'crypto';
import { PoetryPyprojectToml, PoetryPyprojectTomlSource } from '../../types';
import { BuildExecutorSchema } from '../../../../executors/build/schema';
import { Logger } from '../../../../executors/utils/logger';
import { getLoggingTab } from '../../../utils';
import { BaseDependencyResolver } from './base';

/**
 * Resolves project dependencies for Poetry package manager when lockedVersion is false.
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
 *
 * Unlike UV, Poetry uses a different structure for dependencies and extras,
 * with dependencies stored as objects with version, path, and optional properties.
 */
export class ProjectDependencyResolver extends BaseDependencyResolver {
  constructor(
    logger: Logger,
    options: BuildExecutorSchema,
    context: ExecutorContext,
  ) {
    super(logger, options, context);
  }

  /**
   * Applies dependency resolution to the pyproject.toml configuration.
   *
   * This is the main entry point that processes all dependencies in the project,
   * including local workspace dependencies and their optional dependencies.
   *
   * @param root - The root path of the current project
   * @param buildFolderPath - The build output directory path
   * @param buildTomlData - The pyproject.toml configuration to modify
   * @returns Modified pyproject.toml configuration with resolved dependencies
   */
  apply(
    root: string,
    buildFolderPath: string,
    buildTomlData: PoetryPyprojectToml,
  ): PoetryPyprojectToml {
    this.logger.info(chalk`  Resolving dependencies...`);

    return this.updatePyproject(root, buildTomlData, buildFolderPath);
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
   * Poetry-specific handling includes:
   * - Managing dependency objects with version, path, and optional properties
   * - Handling extras as arrays of dependency names
   * - Converting optional dependencies to required when referenced via extras
   *
   * @param root - The root path of the current project
   * @param pyproject - The pyproject.toml configuration to modify
   * @param buildFolderPath - The build output directory path
   * @param loggedDependencies - Array of already logged dependencies to avoid duplicates
   * @returns Modified pyproject.toml configuration
   */
  private updatePyproject(
    root: string,
    pyproject: PoetryPyprojectToml,
    buildFolderPath: string,
    loggedDependencies: string[] = [],
  ): PoetryPyprojectToml {
    const tab = getLoggingTab(1);

    // Step 1: Get the main dependencies object from Poetry configuration
    // Poetry stores dependencies in tool.poetry.dependencies
    const targetDependencies = this.getMainDependencyObject(pyproject);

    let hasMoreLevels = false;

    // Step 2: Process each dependency in the project
    for (const name in targetDependencies) {
      if (name === 'python') {
        continue; // Skip Python version specification
      }

      const data = targetDependencies[name];

      // Step 3: Handle string-based dependencies (simple version constraints)
      if (typeof data === 'string') {
        if (!loggedDependencies) {
          this.logger.info(
            chalk`${tab}• Adding {blue.bold ${name}@${data}} dependency`,
          );
          loggedDependencies.push(name);
        }
      } else if (data.path) {
        // Step 4: Handle local workspace dependencies with path references
        // Calculate the relative path from current working directory to the dependency
        const depPath = relative(process.cwd(), resolve(root, data.path));
        const depPyprojectPath = join(depPath, 'pyproject.toml');

        // Load and parse the local dependency's pyproject.toml
        const depPyproject = parse(
          readFileSync(depPyprojectPath).toString('utf-8'),
        ) as PoetryPyprojectToml;

        // Get the Nx project configuration for the local dependency
        const config = this.getProjectConfig(depPath);
        const targetOptions: BuildExecutorSchema | undefined =
          config.targets?.build?.options;

        // Check if the local dependency should be published (default: true)
        const publisable = targetOptions?.publish ?? true;

        // Step 5: Handle bundle mode - include local dependency in the build
        if (
          this.options.bundleLocalDependencies === true ||
          publisable === false
        ) {
          const packageName = depPyproject.tool.poetry.name;

          // Log the dependency being added (avoid duplicates)
          if (!loggedDependencies.includes(packageName)) {
            this.logger.info(
              chalk`${tab}• Adding {blue.bold ${packageName}} local dependency`,
            );
            loggedDependencies.push(packageName);
          }

          // Step 5a: Include the local dependency's package in the build
          // This copies the source code and updates the pyproject.toml structure
          includeDependencyPackage(
            depPyproject,
            depPath,
            buildFolderPath,
            pyproject,
          );

          // Step 5b: Get all dependencies from the local dependency
          const depDependencies =
            this.getPyProjectMainDependencies(depPyproject);

          // Step 5c: Remove the local dependency from the target pyproject
          // since it's now included in the build
          delete targetDependencies[packageName];

          // Step 5d: Merge optional dependencies (extras) from the local dependency
          const depExtras = depPyproject.tool?.poetry?.extras ?? {};
          const targetExtras = pyproject.tool?.poetry?.extras ?? {};

          // Merge the extras from the local sub dependency to the target pyproject
          if (depPyproject?.tool?.poetry?.extras) {
            for (const [extraName, extraData] of Object.entries(depExtras)) {
              if (targetExtras[extraName]) {
                // If the extra already exists, merge the dependencies using Set to avoid duplicates
                targetExtras[extraName] = [
                  ...new Set([...targetExtras[extraName], ...extraData]),
                ];
              } else {
                // If the extra doesn't exist, create it
                targetExtras[extraName] = extraData;
              }
            }

            pyproject.tool.poetry.extras = targetExtras;
          }

          // Step 5e: Process each dependency from the local dependency
          for (const [depName, depData] of depDependencies) {
            if (depName === 'python') {
              continue; // Skip Python version specification
            }

            // Step 5f: Check if this dependency is also a local dependency
            if (typeof depData === 'object' && depData.path) {
              // This is a multi-level local dependency - mark for recursive processing
              hasMoreLevels = true;

              // Add the nested local dependency with merged extras
              targetDependencies[depName] = {
                ...depData,
                extras:
                  // If the target dependency has extras, merge them with the sub dependency extras
                  typeof targetDependencies[depName] === 'object' &&
                  targetDependencies[depName]?.extras
                    ? [
                        ...new Set([
                          ...(targetDependencies[depName]?.extras ?? []),
                          ...(depData.extras ?? []),
                        ]),
                      ]
                    : depData.extras,
                // Update the path to be relative to the current project
                path: relative(
                  join(process.cwd(), root),
                  resolve(depPath, depData.path),
                ),
              };
            } else {
              // Step 5g: This is a regular external dependency - add it directly
              targetDependencies[depName] = depData;

              if (!loggedDependencies.includes(depName)) {
                this.logger.info(
                  chalk`${tab}• Adding {blue.bold ${depName}@${typeof depData === 'string' ? depData : depData.version}} dependency`,
                );
                loggedDependencies.push(depName);
              }
            }

            // Step 5h: Handle extras promotion - convert optional dependencies to required
            if (data.extras && !data.optional) {
              for (const extraName of data.extras) {
                const libsToSetToMain = depExtras[extraName] ?? [];
                for (const lib of libsToSetToMain) {
                  /**
                   * Change optional to false when the dependency is optional
                   * on the local sub dependency, but it is required by the
                   * target dependency via an extra.
                   *
                   * Example:
                   *
                   * Target pyproject.toml:
                   *
                   * [[tool.poetry.packages]]
                   * include = "app"
                   *
                   * [tool.poetry.dependencies]
                   * python = ">=3.10,<3.11"
                   * lib = { path = "libs/lib", extras = ["color"] }
                   *
                   * Sub dependency pyproject.toml:
                   *
                   * [[tool.poetry.packages]]
                   * include = "lib"
                   *
                   * [tool.poetry.dependencies]
                   * python = ">=3.10,<3.11"
                   * colored = { version = "^2.3.0", optional = true }
                   * python-json-logger = { version = "^2.0.4", optional = true }
                   *
                   * [tool.poetry.extras]
                   * color = ["colored"]
                   * json = ["python-json-logger"]
                   *
                   * This will result in the following pyproject.toml:
                   *
                   * [[tool.poetry.packages]]
                   * include = "app"
                   *
                   * [[tool.poetry.packages]]
                   * include = "lib"
                   *
                   * [tool.poetry.dependencies]
                   * python = ">=3.10,<3.11"
                   * colored = "^2.3.0"
                   * python-json-logger = { version = "^2.0.4", optional = true }
                   *
                   * [tool.poetry.extras]
                   * json = ["python-json-logger"]
                   */
                  if (
                    targetDependencies[lib] &&
                    typeof targetDependencies[lib] === 'object' &&
                    targetDependencies[lib].optional
                  ) {
                    const dep = targetDependencies[lib];
                    // Convert optional dependency to required by removing optional flag
                    // or converting to simple version string if no other properties
                    targetDependencies[lib] =
                      dep.markers || dep.extras || dep.git || dep.source
                        ? {
                            ...dep,
                            optional: undefined,
                          }
                        : dep.version;
                  }
                }
              }
            }
          }
        } else {
          // Step 6: Handle publish mode - reference local dependency by version
          const source = this.addSource(pyproject, targetOptions);
          if (source) {
            // Add with custom source if specified
            targetDependencies[name] = {
              version: depPyproject.tool.poetry.version,
              source: source,
            };
          } else {
            // Add as simple version string
            targetDependencies[name] = depPyproject.tool.poetry.version;
          }

          if (!loggedDependencies.includes(name)) {
            this.logger.info(
              chalk`${tab}• Adding {blue.bold ${name}@${depPyproject.tool.poetry.version}} local dependency`,
            );
            loggedDependencies.push(name);
          }
        }
      } else {
        // Step 7: This is an external dependency - just log it
        if (!loggedDependencies.includes(name)) {
          this.logger.info(
            chalk`${tab}• Adding {blue.bold ${name}${data.version ? `@${data.version}` : data.git ? ` ${data.git}@${data.rev}` : ''}} dependency`,
          );
          loggedDependencies.push(name);
        }
      }
    }

    // Step 8: Clean up optional dependencies that are no longer optional
    // Remove extras that are not optional anymore
    for (const [extraName, extraData] of Object.entries(
      pyproject.tool?.poetry?.extras ?? {},
    )) {
      // Filter out dependencies that are no longer optional (have optional: false or are strings)
      pyproject.tool.poetry.extras[extraName] = extraData.filter(
        (d) =>
          targetDependencies[d] &&
          typeof targetDependencies[d] === 'object' &&
          targetDependencies[d].optional,
      );

      // Remove empty optional dependency groups
      if (!pyproject.tool.poetry.extras[extraName]?.length) {
        delete pyproject.tool.poetry.extras[extraName];
      }
    }

    // Step 9: Recursive processing for multi-level dependencies
    // If there are more local dependencies to resolve, call this function again
    // until there are no more local dependencies to resolve.
    if (hasMoreLevels) {
      this.updatePyproject(
        root,
        pyproject,
        buildFolderPath,
        loggedDependencies,
      );
    }

    return pyproject;
  }

  /**
   * Adds a custom source to the pyproject.toml if specified in build options.
   *
   * Poetry uses "sources" instead of "indexes" (UV terminology) for custom
   * package repositories.
   *
   * @param buildTomlData - The pyproject.toml configuration to modify
   * @param targetOptions - Build options that may contain custom source URL
   * @returns The name of the added source, or undefined if no custom source
   */
  private addSource(
    buildTomlData: PoetryPyprojectToml,
    targetOptions: BuildExecutorSchema,
  ): string | undefined {
    if (!targetOptions?.customSourceUrl) return undefined;

    const [newSources, newSourceName] = this.resolveDuplicateSources(
      buildTomlData.tool.poetry.source,
      {
        name: targetOptions.customSourceName,
        url: targetOptions.customSourceUrl,
      },
    );

    buildTomlData.tool.poetry.source = newSources;

    return newSourceName;
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
      if (normalize(config.root) === normalize(root)) {
        return config;
      }
    }

    throw new Error(`Could not find project config for ${root}`);
  }

  /**
   * Resolves duplicate sources by creating unique names with MD5 hashes.
   *
   * When multiple sources have the same name but different URLs, this method
   * creates a new unique name by appending an MD5 hash of the URL.
   *
   * Poetry uses "sources" instead of "indexes" (UV terminology) for custom
   * package repositories.
   *
   * @param sources - Existing sources array
   * @param newSource - The new source to add
   * @returns Tuple of [updated sources array, final source name]
   */
  private resolveDuplicateSources = (
    sources: PoetryPyprojectTomlSource[],
    { name, url }: PoetryPyprojectTomlSource,
  ): [PoetryPyprojectTomlSource[], string] => {
    if (!sources) {
      return [[{ name, url }], name];
    }

    const existing = sources.find((s) => s.name === name);

    if (existing) {
      if (existing.url === url) {
        return [sources, name];
      }

      const hash = createHash('md5').update(url).digest('hex');
      const newName = `${name}-${hash}`;

      this.logger.info(
        chalk`  Duplicate source for {blue.bold ${name}} renamed to ${newName}`,
      );

      if (sources.find((s) => s.name === newName)) {
        return [sources, newName];
      }

      return [[...sources, { name: newName, url }], newName];
    }

    return [[...sources, { name, url }], name];
  };
}
