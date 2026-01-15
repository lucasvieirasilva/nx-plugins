import {
  ImplicitDependency,
  DependencyType,
  CreateDependencies,
  logger,
  StaticDependency,
  DynamicDependency,
} from '@nx/devkit';
import { getProvider } from '../provider';
import { PluginOptions } from '../types';
import { glob } from 'glob';
import { join } from 'node:path';
import { hashFile } from 'nx/src/hasher/file-hasher';
import { readFile } from 'node:fs/promises';
import fs from 'node:fs';

const cachedScannedFiles: Record<string, [string, string][]> = {};

const IMPORT_REGEX = /(?:import|from)\s+([a-zA-Z_][\w]*)/g;

export const createDependencies: CreateDependencies<PluginOptions> = async (
  options,
  context,
) => {
  const result: Array<
    ImplicitDependency | StaticDependency | DynamicDependency
  > = [];
  const { inferDependencies } = options ?? { inferDependencies: false };
  const provider = await getProvider(
    context.workspaceRoot,
    undefined,
    undefined,
    undefined,
    options,
  );

  const projectModulesMap = new Map<string, string[]>();
  const moduleProjectMap = new Map<string, string>();

  if (inferDependencies) {
    for (const project in context.projects) {
      const modules = provider.getModulesFolders(
        context.projects[project].root,
      );
      projectModulesMap.set(project, modules);
      for (const module of modules) {
        const moduleName = module.split('/').pop();
        if (moduleName) {
          moduleProjectMap.set(moduleName, project);
        }
      }
    }
  }

  for (const project in context.projects) {
    const explicitDeps = provider
      .getDependencies(project, context.projects, context.workspaceRoot)
      .map((dep) => dep.name);

    const implicitDeps: [string, string][] = [];

    if (inferDependencies) {
      const sourceFolders = projectModulesMap.get(project);
      const sourceFoldersPatterns = sourceFolders.map((folder) =>
        join(folder, '**', '*.py'),
      );
      const filesToScan = (
        await glob(sourceFoldersPatterns, {
          cwd: context.workspaceRoot,
          fs,
        })
      ).map((file) => [file, hashFile(file)]);

      logger.verbose(`[${project}] Scanning ${filesToScan.length} files`);

      await Promise.all(
        filesToScan.map(async ([file, hash]) => {
          const hashKey = `${file}-${hash}`;
          const cached = cachedScannedFiles[hashKey];
          if (cached) {
            logger.verbose(
              `[${project}] [${file}] Found cached modules: ${Array.from(cached).join(', ')}`,
            );
            for (const [file, module] of cached) {
              if (moduleProjectMap.has(module)) {
                const project = moduleProjectMap.get(module);
                if (project) {
                  implicitDeps.push([project, file]);
                }
              }
            }
          } else {
            const content = await readFile(file, { encoding: 'utf-8' });
            const fileModules: [string, string][] = [];
            for (const match of content.matchAll(IMPORT_REGEX)) {
              const module = match[1].trim();
              fileModules.push([file, module]);
              logger.verbose(`[${project}] [${file}] Found module: ${module}`);
              if (moduleProjectMap.has(module)) {
                const project = moduleProjectMap.get(module);
                if (project) {
                  implicitDeps.push([project, file]);
                }
              }
            }
            cachedScannedFiles[hashKey] = fileModules;
          }
        }),
      );
    }

    explicitDeps.forEach((dep) => {
      result.push({
        source: project,
        target: dep,
        type: DependencyType.implicit,
      });
    });

    Array.from(implicitDeps)
      .filter(([depProject]) => !explicitDeps.includes(depProject))
      .forEach(([depProject, file]) => {
        result.push({
          source: project,
          target: depProject,
          type: DependencyType.dynamic,
          sourceFile: file,
        });
      });
  }

  return result;
};
