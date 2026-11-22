import {
  ImplicitDependency,
  DependencyType,
  CreateDependencies,
  CreateDependenciesContext,
  CreateNodesResult,
  CreateNodesV2,
  createNodesFromFiles,
  joinPathFragments,
  logger,
  NxJsonConfiguration,
  StaticDependency,
  DynamicDependency,
} from '@nx/devkit';
import { getProvider } from '../provider';
import {
  getDefaultPythonProjectTargets,
  updateNxReleaseConfig,
} from '../generators/utils';
import { BasePythonProjectGeneratorSchema } from '../generators/types';
import { PluginOptions } from '../types';
import { readFile } from 'node:fs/promises';
import { posix } from 'node:path';
import { extractImportedModules, getPythonParser } from './infer';

const cachedScannedFiles: Record<string, [string, string][]> = {};

const LOCK_FILES = new Set(['uv.lock', 'poetry.lock']);

const DEFAULT_TEST_FILES = [
  'tests/**/*',
  '**/test_*.py',
  '**/*_test.py',
  '**/conftest.py',
];

type Provider = Awaited<ReturnType<typeof getProvider>>;

export const createNodesV2: CreateNodesV2<PluginOptions> = [
  '**/{uv.lock,poetry.lock,pyproject.toml}',
  async (files, options, context) => {
    if (!options?.externalNodes && !options?.inferProjects) {
      return [];
    }
    const provider = await getProvider(
      context.workspaceRoot,
      undefined,
      undefined,
      undefined,
      options,
    );
    const result: Array<[string, CreateNodesResult]> = [];
    if (options.externalNodes) {
      result.push(...lockGraphNodes(provider, files));
    }
    if (options.inferProjects) {
      result.push(
        ...(await createNodesFromFiles(
          (file) =>
            inferProject(provider, file, options, context.nxJsonConfiguration),
          files.filter((file) => posix.basename(file) === 'pyproject.toml'),
          options,
          context,
        )),
      );
    }
    return result;
  },
];

function lockGraphNodes(
  provider: Provider,
  files: readonly string[],
): Array<[string, CreateNodesResult]> {
  const lockFiles = files.filter((file) =>
    LOCK_FILES.has(posix.basename(file)),
  );
  const lockGraph = provider.getLockGraph(lockFiles);
  if (!lockGraph) {
    return [];
  }
  // Every matched file reports the same nodes; Nx merges them by name.
  return lockFiles.map((file) => [
    file,
    { externalNodes: lockGraph.externalNodes },
  ]);
}

// A pyproject.toml that names no package is not a project: a virtual workspace
// root, or a file that only holds tool configuration.
async function inferProject(
  provider: Provider,
  file: string,
  options: PluginOptions,
  nxJson: NxJsonConfiguration,
): Promise<CreateNodesResult | null> {
  const projectRoot = posix.dirname(file);
  const name = provider.getMetadata(projectRoot)?.name;
  if (!name) {
    return null;
  }
  // A member of a shared workspace is locked and configured at its root.
  const workspaceRoot = provider.getWorkspaceRoot(projectRoot);
  const workspaceFiles =
    workspaceRoot === null || posix.normalize(workspaceRoot) === projectRoot
      ? []
      : [provider.lockFileName, 'pyproject.toml', '.python-version'].map(
          (workspaceFile) =>
            `{workspaceRoot}/${joinPathFragments(workspaceRoot, workspaceFile)}`,
        );
  const { test, ...targets } = await inferTargets(provider, projectRoot);
  return {
    projects: {
      [projectRoot]: updateNxReleaseConfig({
        root: projectRoot,
        name,
        namedInputs: {
          production: [
            ...(nxJson.namedInputs?.production ?? ['default']),
            ...(options.testFiles ?? DEFAULT_TEST_FILES).map(
              (pattern) => `!{projectRoot}/${pattern}`,
            ),
            ...workspaceFiles,
          ],
        },
        targets: {
          ...targets,
          [options.testTargetName ?? 'test']: {
            ...test,
            inputs: ['default', '^production', ...workspaceFiles],
          },
        },
      }),
    },
  };
}

// The targets the project generators write, with their default options. The
// linter is the one the project configures: a `.flake8` file, or a
// `[tool.ruff]` table in its pyproject.toml.
async function inferTargets(provider: Provider, projectRoot: string) {
  const pyproject = provider.getPyprojectToml(projectRoot) as {
    tool?: { ruff?: unknown };
  };
  let linter: BasePythonProjectGeneratorSchema['linter'] = 'none';
  if (provider.fileExists(joinPathFragments(projectRoot, '.flake8'))) {
    linter = 'flake8';
  } else if (pyproject.tool?.ruff) {
    linter = 'ruff';
  }
  const targets = await getDefaultPythonProjectTargets(
    {
      publishable: false,
      buildLockedVersions: true,
      buildBundleLocalDependencies: true,
      linter,
      moduleName: '',
      unitTestRunner: 'pytest',
    },
    provider,
  );
  if (linter === 'ruff') {
    targets['format'].options.filePatterns = [];
    targets['lint'].options.lintFilePatterns = [];
  }
  targets.install = {
    executor: '@nxlv/python:install',
    options: {
      silent: false,
      args: '',
      verbose: false,
      debug: false,
    },
  };
  return targets;
}

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
  provider: Provider,
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
