import { ExecutorContext, ProjectsConfigurations } from '@nx/devkit';
import chalk from 'chalk';
import {
  getDependents,
  PyprojectToml,
  PyprojectTomlDependencies,
} from '../graph/dependency-graph';
import {
  getProjectTomlPath,
  parseToml,
  runPoetry,
  updateProject,
} from '../executors/utils/poetry';
import { existsSync, readFileSync } from 'fs-extra';
import { parse } from '@iarna/toml';

export function updateDependencyTree(context: ExecutorContext) {
  const rootPyprojectToml = existsSync('pyproject.toml');
  const pkgName = getProjectPackageName(context, context.projectName);

  updateDependents(
    context,
    context.workspace,
    context.projectName,
    rootPyprojectToml,
    context.root,
  );

  if (rootPyprojectToml) {
    const rootPyprojectToml = parse(
      readFileSync('pyproject.toml', { encoding: 'utf-8' }),
    ) as PyprojectToml;

    const allRootDependencyNames = Object.keys(
      getAllDependenciesFromPyprojectToml(rootPyprojectToml),
    );

    if (allRootDependencyNames.includes(pkgName)) {
      console.log(
        chalk`\nUpdating root {bold pyproject.toml} dependency {bold ${pkgName}}`,
      );

      runPoetry(['lock', '--no-update']);
      runPoetry(['install']);
    }
  }
}

export function updateDependents(
  context: ExecutorContext,
  workspace: ProjectsConfigurations,
  projectName: string,
  updateLockOnly: boolean,
  workspaceRoot: string,
  updatedProjects: string[] = [],
) {
  updatedProjects.push(projectName);
  const deps = getDependents(projectName, workspace.projects, workspaceRoot);

  for (const dep of deps) {
    if (updatedProjects.includes(dep)) {
      continue;
    }

    console.log(chalk`\nUpdating project {bold ${dep}}`);
    const depConfig = workspace.projects[dep];

    const pkgName = getProjectPackageName(context, projectName);
    updateProject(pkgName, depConfig.root, updateLockOnly);

    updateDependents(
      context,
      workspace,
      dep,
      updateLockOnly,
      workspaceRoot,
      updatedProjects,
    );
  }
}

function getProjectPackageName(context: ExecutorContext, projectName: string) {
  const projectConfig = context.workspace.projects[projectName];
  const projectToml = getProjectTomlPath(projectConfig);
  const {
    tool: {
      poetry: { name },
    },
  } = parseToml(projectToml);

  return name;
}

/**
 * Parses all dependency names from a Pyproject.toml file
 * and returns a flattened collection of dependencies
 *
 * Optionally you may supply a list of groups to ignore
 */
export const getAllDependenciesFromPyprojectToml = (
  tomlData: PyprojectToml,
  /** optional dependency groups to omit from collection */
  omitGroups: string[] = [],
): PyprojectTomlDependencies => {
  return {
    ...tomlData.tool?.poetry?.dependencies,
    ...Object.fromEntries(
      Object.entries(tomlData.tool.poetry.group)
        .filter(([name]) => !omitGroups.includes(name))
        .flatMap(([_, group]) => Object.entries(group.dependencies)),
    ),
  };
};
