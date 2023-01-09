import {
  ProjectGraphBuilder,
  ProjectGraph,
  ProjectGraphProcessorContext,
  joinPathFragments,
  Workspace,
  ProjectsConfigurations,
  ProjectConfiguration,
} from '@nrwl/devkit';
import { readFileSync, existsSync } from 'fs';
import { parse } from '@iarna/toml';
import path from 'path';

export type PyprojectTomlDependency = string | {
  path?: string,
  version?: string,
  markers?: string,
  optional?: boolean,
  extras?: string[],
  develop?: boolean
}

export type PyprojectTomlDependencies = {
  [key: string]: PyprojectTomlDependency
}

export type DependencyCategory = 'main' | 'dev'

export type Dependency = {
  name: string
  category: DependencyCategory
}

export type PyprojectToml = {
  tool: {
    poetry: {
      name: string
      packages: Array<{
        include: string
      }>,
      dependencies: PyprojectTomlDependencies,
      group?: {
        [key: string]: {
          dependencies: PyprojectTomlDependencies
        }
      },
      extras?: {
        [key: string]: string[]
      }
      plugins?: {
        [key: string]: {
          [key: string]: string
        }
      }
    }
  }
}

export const getDependents = (
  projectName: string,
  workspace: Workspace | ProjectsConfigurations,
  cwd: string
): string[] => {
  const deps: string[] = [];

  const { root } = workspace.projects[projectName];

  for (const project in workspace.projects) {
    if (checkProjectIsDependent(workspace, project, root, cwd)) {
      deps.push(project)
    }
  }

  return deps;
};

export const getDependencies = (
  projectName: string,
  workspace: Workspace | ProjectsConfigurations,
  cwd: string
): Dependency[] => {
  const projectData = workspace.projects[projectName];
  const pyprojectToml = joinPathFragments(projectData.root, 'pyproject.toml');

  const deps: Dependency[] = [];

  if (existsSync(pyprojectToml)) {
    const tomlData = getPyprojectData(pyprojectToml);
    resolveDependencies(tomlData.tool.poetry.dependencies, projectData, workspace, cwd, deps, 'main');
    resolveDependencies(tomlData.tool.poetry.group?.dev.dependencies, projectData, workspace, cwd, deps, 'dev');
  }

  return deps;
};

export const processProjectGraph = (
  graph: ProjectGraph,
  context: ProjectGraphProcessorContext
) => {
  const builder = new ProjectGraphBuilder(graph);

  for (const project in context.workspace.projects) {
    const deps = getDependencies(project, context.workspace, process.cwd());

    deps.forEach((dep) =>
      builder.addImplicitDependency(project, dep.name)
    );
  }

  return builder.graph;
};

const getPyprojectData = (pyprojectToml: string) => {
  return parse(
    readFileSync(pyprojectToml).toString('utf-8')
  ) as PyprojectToml;
};

const checkProjectIsDependent = (
  workspace: Workspace | ProjectsConfigurations,
  project: string,
  root: string,
  cwd: string
): boolean => {
  const projectData = workspace.projects[project];
  const pyprojectToml = joinPathFragments(projectData.root, 'pyproject.toml');

  if (existsSync(pyprojectToml)) {
    const tomlData = getPyprojectData(pyprojectToml);

    return isProjectDependent(
      tomlData.tool.poetry.dependencies,
      projectData,
      root,
      cwd
    ) || isProjectDependent(
      tomlData.tool.poetry.group?.dev.dependencies,
      projectData,
      root,
      cwd
    );
  }

  return false;
};

const isProjectDependent = (
  dependencies: PyprojectTomlDependencies,
  projectData: ProjectConfiguration,
  root: string,
  cwd: string
): boolean => {
  for (const dep in dependencies || {}) {
    const depData = dependencies[dep];

    if (depData instanceof Object && depData.path) {
      const depAbsPath = path.resolve(projectData.root, depData.path);

      if (path.normalize(root) === path.normalize(path.relative(cwd, depAbsPath))) {
        return true;
      }
    }
  }
  return false
}

const resolveDependencies = (
  dependencies: PyprojectTomlDependencies,
  projectData: ProjectConfiguration,
  workspace: Workspace | ProjectsConfigurations,
  cwd: string,
  deps: Dependency[],
  category: DependencyCategory
) => {
  for (const dep in dependencies || {}) {
    const depData = dependencies[dep];

    if (depData instanceof Object && depData.path) {
      const depAbsPath = path.resolve(projectData.root, depData.path);
      const depProjectName = Object.keys(workspace.projects).find(
        (proj) => path.normalize(workspace.projects[proj].root) === path.normalize(path.relative(cwd, depAbsPath))
      );

      deps.push({ name: depProjectName, category });
    }
  }
}

