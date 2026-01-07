import {
  ExecutorContext,
  ExpandedPluginConfiguration,
  ProjectConfiguration,
  Tree,
  createProjectGraphAsync,
  joinPathFragments,
  logger,
  readNxJson,
} from '@nx/devkit';
import { getProvider } from '../../provider';
import { PluginOptions } from '../../types';
import { type SyncGeneratorResult } from 'nx/src/utils/sync-generators';
import { SyncGeneratorCallback } from '../../provider/base';

export default async function syncGenerator(
  tree: Tree,
): Promise<SyncGeneratorResult> {
  const nxJson = readNxJson(tree);
  const pluginConfig = nxJson.plugins?.find(
    (plugin): plugin is ExpandedPluginConfiguration =>
      typeof plugin === 'object' && plugin.plugin === '@nxlv/python',
  );

  const pluginOptions = pluginConfig?.options as PluginOptions | undefined;
  const provider = await getProvider(
    '',
    undefined,
    tree,
    undefined,
    pluginOptions,
  );
  const projectGraph = await createProjectGraphAsync();
  const projects = Object.entries(projectGraph.nodes).reduce<
    Record<string, ProjectConfiguration>
  >((acc, [project, node]) => {
    acc[project] = node.data;
    return acc;
  }, {});

  let outOfSyncMessage = '';
  const context: ExecutorContext = {
    cwd: tree.root,
    isVerbose: false,
    nxJsonConfiguration: nxJson,
    projectGraph: projectGraph,
    projectsConfigurations: {
      version: 2,
      projects,
    },
    root: tree.root,
  };
  const callbacks: SyncGeneratorCallback[] = [];

  for (const project in projectGraph.nodes) {
    const projectRoot = projectGraph.nodes[project].data.root;
    if (tree.exists(joinPathFragments(projectRoot, 'pyproject.toml'))) {
      const graphDependencies =
        projectGraph.dependencies[project]?.map((dep) => dep.target) ?? [];
      const pyprojectDependencies = new Set(
        provider
          .getDependencies(project, projects, tree.root)
          .map((dep) => dep.name),
      );
      const missingDependencies = graphDependencies.filter(
        (dep) => !pyprojectDependencies.has(dep),
      );
      if (missingDependencies.length > 0) {
        const message = `Project ${project} is out of sync. Missing dependencies: ${missingDependencies.join(', ')}\n`;
        outOfSyncMessage += message;
        logger.info(message);
      }

      const syncResult = await provider.syncGenerator(
        project,
        missingDependencies,
        {
          ...context,
          projectName: project,
        },
      );

      callbacks.push(...syncResult.callbacks);
      outOfSyncMessage += syncResult.outOfSyncMessage;
    }
  }

  return {
    callback: async () => {
      const executedCallbacks: string[] = [];
      for (const { actions, description, callback } of callbacks) {
        if (executedCallbacks.some((action) => actions.includes(action))) {
          continue;
        }

        logger.info(`Running callback: ${description ?? actions.join(', ')}`);
        const result = callback();
        if (result instanceof Promise) {
          await result;
        }
        executedCallbacks.push(...actions);
      }
    },
    outOfSyncMessage,
  };
}
