import {
  ImplicitDependency,
  DependencyType,
  CreateDependencies,
  CreateDependenciesContext,
  CreateNodesV2,
  logger,
  StaticDependency,
  DynamicDependency,
} from '@nx/devkit';
import { getProvider } from '../provider';
import { PluginOptions } from '../types';
import { readFile } from 'node:fs/promises';
import { extractImportedModules, getPythonParser } from './infer';

const cachedScannedFiles: Record<string, [string, string][]> = {};

const LOCK_FILES = new Set(['uv.lock', 'poetry.lock']);

export const createNodesV2: CreateNodesV2<PluginOptions> = [
  '**/{uv,poetry}.lock',
  async (files, options, context) => {
    if (!options?.externalNodes) {
      return [];
    }
    const provider = await getProvider(
      context.workspaceRoot,
      undefined,
      undefined,
      undefined,
      options,
    );
    const lockGraph = provider.getLockGraph([...files]);
    if (!lockGraph) {
      return [];
    }
    // Every matched file reports the same nodes; Nx merges them by name.
    return files.map((file) => [
      file,
      { externalNodes: lockGraph.externalNodes },
    ]);
  },
];

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
      const filesToScan = (context.fileMap.projectFileMap[project] ?? [])
        .filter(
          ({ file }) =>
            file.endsWith('.py') &&
            sourceFolders.some((folder) => file.startsWith(`${folder}/`)),
        )
        .map(({ file, hash }) => [file, hash]);

      logger.verbose(`[${project}] Scanning ${filesToScan.length} files`);

      const parser = await getPythonParser();

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
            for (const module of extractImportedModules(parser, content)) {
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

  if (options?.externalNodes) {
    result.push(...lockGraphDependencies(provider, context));
  }

  return result;
};

// Each member's edges to the packages it installs. A project that owns its lock
// file records them on it: they come from the lock, not pyproject.toml, and Nx
// restores an unchanged file's cached edges over freshly computed ones. A
// shared lock file cannot carry them, because Nx keeps one edge per target on
// a workspace file whichever project added it, so there they go in as
// implicit edges, which Nx recomputes on every build.
function lockGraphDependencies(
  provider: Awaited<ReturnType<typeof getProvider>>,
  context: CreateDependenciesContext,
): Array<ImplicitDependency | StaticDependency> {
  const { nonProjectFiles, projectFileMap } = context.fileMap;
  const isLockFile = ({ file }: { file: string }) =>
    LOCK_FILES.has(file.split('/').pop());
  const lockGraph = provider.getLockGraph(
    [nonProjectFiles, ...Object.values(projectFileMap)]
      .flat()
      .filter(isLockFile)
      .map(({ file }) => file),
  );
  if (!lockGraph) {
    return [];
  }
  return Object.entries(context.projects).flatMap(([project, { root }]) => {
    const member = lockGraph.members[root];
    if (!member) {
      return [];
    }
    // Also record edges on a shared lock file (from nonProjectFiles) once Nx
    // fixes https://github.com/nrwl/nx/issues/37213.
    const onLockFile = (projectFileMap[project] ?? []).some(
      ({ file }) => file === member.lockFile,
    );
    return member.dependencies
      .filter((target) => context.externalNodes[target])
      .map((target) =>
        onLockFile
          ? {
              source: project,
              target,
              type: DependencyType.static,
              sourceFile: member.lockFile,
            }
          : { source: project, target, type: DependencyType.implicit },
      );
  });
}
