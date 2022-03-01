import {
  ProjectGraphBuilder,
  ProjectGraph,
  ProjectGraphProcessorContext,
  joinPathFragments,
  Workspace,
  WorkspaceJsonConfiguration,
} from '@nrwl/devkit';
import { readFileSync, existsSync } from 'fs';
import { parse } from '@iarna/toml';
import path from 'path';

export const getDependents = (
  projectName: string,
  workspace: Workspace | WorkspaceJsonConfiguration,
  cwd: string = process.cwd()
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
  workspace: Workspace | WorkspaceJsonConfiguration,
  cwd: string = process.cwd()
): string[] => {
  const projectData = workspace.projects[projectName];
  const pyprojectToml = joinPathFragments(projectData.root, 'pyproject.toml');

  const deps = [];

  if (existsSync(pyprojectToml)) {
    const tomlData = getPyprojectData(pyprojectToml);

    for (const dep in tomlData.tool.poetry.dependencies) {
      const depData = tomlData.tool.poetry.dependencies[dep];

      if (depData instanceof Object && depData.path) {
        const depAbsPath = path.resolve(projectData.root, depData.path);
        const depProjectName = Object.keys(workspace.projects).find(
          (proj) =>
            workspace.projects[proj].root === path.relative(cwd, depAbsPath)
        );

        deps.push(depProjectName);
      }
    }
  }

  return deps;
};

export const processProjectGraph = (
  graph: ProjectGraph,
  context: ProjectGraphProcessorContext
) => {
  const builder = new ProjectGraphBuilder(graph);

  for (const project in context.workspace.projects) {
    const deps = getDependencies(project, context.workspace);

    deps.forEach((dep) =>
      builder.addImplicitDependency(project, dep)
    );
  }

  return builder.graph;
};

const getPyprojectData = (pyprojectToml: string) => {
  return parse(
    readFileSync(pyprojectToml).toString('utf-8')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any;
};

const checkProjectIsDependent = (
  workspace: Workspace | WorkspaceJsonConfiguration,
  project: string,
  root: string,
  cwd: string
): boolean => {
  const projectData = workspace.projects[project];
  const pyprojectToml = joinPathFragments(projectData.root, 'pyproject.toml');

  if (existsSync(pyprojectToml)) {
    const tomlData = getPyprojectData(pyprojectToml);

    for (const dep in tomlData.tool.poetry.dependencies) {
      const depData = tomlData.tool.poetry.dependencies[dep];

      if (depData instanceof Object && depData.path) {
        const depAbsPath = path.resolve(projectData.root, depData.path);

        if (root === path.relative(cwd, depAbsPath)) {
          return true;
        }
      }
    }
  }

  return false;
};
