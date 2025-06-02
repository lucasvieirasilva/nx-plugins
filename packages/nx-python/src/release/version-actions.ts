import {
  ProjectConfiguration,
  ProjectGraph,
  ProjectGraphDependency,
  readJson,
  Tree,
} from '@nx/devkit';
import { exec } from 'node:child_process';
import { AfterAllProjectsVersioned, VersionActions } from 'nx/release';
import type {
  ExpandedPluginConfiguration,
  NxJsonConfiguration,
} from 'nx/src/config/nx-json';
import { getProvider } from '../provider';
import { PluginOptions } from '../types';
import { BaseProvider } from '../provider/base';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';

let updatedProjects: string[] = [];

export const afterAllProjectsVersioned: AfterAllProjectsVersioned = async (
  cwd: string,
  {
    rootVersionActionsOptions,
    ...opts
  }: {
    dryRun?: boolean;
    verbose?: boolean;
    rootVersionActionsOptions?: Record<string, unknown>;
  },
) => {
  const nxJson = JSON.parse(
    await fs.readFile(path.join(cwd, 'nx.json'), 'utf-8'),
  );
  const pluginConfig = nxJson.plugins?.find(
    (plugin): plugin is ExpandedPluginConfiguration =>
      typeof plugin === 'object' && plugin.plugin === '@nxlv/python',
  );

  const provider = await getProvider(
    cwd,
    undefined,
    undefined,
    undefined,
    pluginConfig?.options as PluginOptions,
  );

  const lockArgs = rootVersionActionsOptions?.lockArgs as string | undefined;
  const skipLockFileUpdate = rootVersionActionsOptions?.skipLockFileUpdate as
    | boolean
    | undefined;

  if (skipLockFileUpdate) {
    return {
      changedFiles: [],
      deletedFiles: [],
    };
  }

  const changedFiles: string[] = [];
  for (const project of updatedProjects) {
    const projectLockFile = path.join(project, provider.lockFileName);
    if (existsSync(projectLockFile)) {
      changedFiles.push(projectLockFile);

      if (!opts.dryRun) {
        await provider.lock(project, false, lockArgs);
      } else {
        console.log(`Would run lock for ${project}`);
      }
    }
  }

  if (provider.isWorkspace) {
    changedFiles.push(provider.lockFileName);

    if (!opts.dryRun) {
      await provider.lock(cwd, false, lockArgs);
    } else {
      console.log(`Would run lock for ${cwd}`);
    }
  }

  updatedProjects = [];

  if (opts.dryRun) {
    console.log(
      `Would add ${changedFiles.length} ${
        changedFiles.length === 1 ? 'file' : 'files'
      } to git: ${changedFiles.join(', ')}`,
    );
  }

  return {
    changedFiles,
    deletedFiles: [],
  };
};

export default class PythonVersionActions extends VersionActions {
  validManifestFilenames = ['pyproject.toml'];
  private provider: BaseProvider;

  async init(tree: Tree, isInProjectsToProcess: boolean): Promise<void> {
    await super.init(tree, isInProjectsToProcess);
    updatedProjects = [];

    const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
    const pluginConfig = nxJson.plugins?.find(
      (plugin): plugin is ExpandedPluginConfiguration =>
        typeof plugin === 'object' && plugin.plugin === '@nxlv/python',
    );
    const provider = await getProvider(
      '.',
      undefined,
      tree,
      undefined,
      pluginConfig?.options as PluginOptions,
    );

    this.provider = provider;
  }

  async readDependencies(
    tree: Tree,
    projectGraph: ProjectGraph,
  ): Promise<ProjectGraphDependency[]> {
    return projectGraph.dependencies[this.projectGraphNode.name] ?? [];
  }

  async readCurrentVersionFromSourceManifest(): Promise<{
    currentVersion: string;
    manifestPath: string;
  }> {
    const sourcePyprojectTomlPath = path.join(
      this.projectGraphNode.data.root,
      'pyproject.toml',
    );

    const metadata = this.provider.getMetadata(this.projectGraphNode.data.root);

    try {
      return {
        manifestPath: sourcePyprojectTomlPath,
        currentVersion: metadata.version,
      };
    } catch {
      throw new Error(
        `Unable to determine the current version for project "${this.projectGraphNode.name}" from ${sourcePyprojectTomlPath}, please ensure that the "version" field is set within the package.json file`,
      );
    }
  }

  async readCurrentVersionFromRegistry(): Promise<{
    currentVersion: string;
    logText: string;
  }> {
    const metadata = this.provider.getMetadata(this.projectGraphNode.data.root);
    const packageName = metadata.name;

    let currentVersion = null;
    try {
      // Must be non-blocking async to allow spinner to render
      currentVersion = await new Promise<string>((resolve, reject) => {
        exec(`pip index versions ${packageName}`, (error, stdout, stderr) => {
          if (error) {
            return reject(error);
          }
          if (stderr) {
            return reject(stderr);
          }
          return resolve(
            stdout.trim().match(new RegExp(`${packageName} \\((.*)\\)`))[1],
          );
        });
      });
    } catch {
      // Do nothing
    }

    return {
      currentVersion,
      logText: '',
    };
  }

  async readCurrentVersionOfDependency(
    tree: Tree,
    projectGraph: ProjectGraph,
    dependencyProjectName: string,
  ): Promise<{
    currentVersion: string | null;
    dependencyCollection: string | null;
  }> {
    const projects = Object.entries(projectGraph.nodes).reduce<
      Record<string, ProjectConfiguration>
    >((acc, [projectName, node]) => {
      acc[projectName] = node.data;
      return acc;
    }, {});

    const dependencies = this.provider.getDependencies(
      this.projectGraphNode.data.name,
      projects,
      tree.root,
    );

    const dependency = dependencies.find(
      (dependency) => dependency.name === dependencyProjectName,
    );

    return {
      currentVersion: dependency?.version,
      dependencyCollection: dependency?.category,
    };
  }

  async updateProjectVersion(
    tree: Tree,
    newVersion: string,
  ): Promise<string[]> {
    const logMessages: string[] = [];
    for (const manifestToUpdate of this.manifestsToUpdate) {
      const projectRoot = path.dirname(manifestToUpdate.manifestPath);
      this.provider.updateVersion(projectRoot, newVersion);
      updatedProjects.push(projectRoot);

      logMessages.push(
        `✍️  New version ${newVersion} written to manifest: ${manifestToUpdate.manifestPath}`,
      );
    }
    return logMessages;
  }

  async updateProjectDependencies(
    tree: Tree,
    projectGraph: ProjectGraph,
    dependenciesToUpdate: Record<string, string>,
  ): Promise<string[]> {
    const projects = Object.entries(projectGraph.nodes).reduce<
      Record<string, ProjectConfiguration>
    >((acc, [projectName, node]) => {
      acc[projectName] = node.data;
      return acc;
    }, {});

    for (const dependency of Object.keys(dependenciesToUpdate)) {
      const dependencyProject = projects[dependency];
      if (!updatedProjects.includes(dependencyProject.root)) {
        updatedProjects.push(dependencyProject.root);
      }

      this.updateProjectDependencies(
        tree,
        projectGraph,
        this.provider
          .getDependencies(dependency, projects, tree.root)
          .reduce<Record<string, string>>((acc, dependency) => {
            acc[dependency.name] = dependency.version;
            return acc;
          }, {}),
      );
    }
    return [];
  }
}
