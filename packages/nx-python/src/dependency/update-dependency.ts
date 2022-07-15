import { ExecutorContext, WorkspaceJsonConfiguration } from '@nrwl/devkit';
import chalk from 'chalk';
import { getDependents, PyprojectToml } from '../graph/dependency-graph';
import {
  getProjectTomlPath,
  parseToml,
  updateProject,
} from '../executors/utils/poetry';
import { existsSync, readFileSync } from 'fs-extra';
import { parse } from '@iarna/toml';
import spawn from 'cross-spawn';

export function updateDependencyTree(context: ExecutorContext) {
  const rootPyprojectToml = existsSync('pyproject.toml')
  const projectConfig = context.workspace.projects[context.projectName];
  const projectToml = getProjectTomlPath(projectConfig);
  const {
    tool: {
      poetry: { name },
    },
  } = parseToml(projectToml);

  updateDependents(context.workspace, context.projectName, name, rootPyprojectToml, context.root);

  if (rootPyprojectToml) {
    const rootPyprojectToml = parse(
      readFileSync('pyproject.toml', { encoding: 'utf-8' })
    ) as PyprojectToml;

    if (rootPyprojectToml.tool.poetry.dependencies[name]) {
      console.log(chalk`\nUpdating root {bold pyproject.toml} dependency {bold ${name}}`);

      spawn.sync('poetry', ['update', name], {
        shell: false,
        stdio: 'inherit',
      });
    }
  }
}

export function updateDependents(
  workspace: WorkspaceJsonConfiguration,
  projectName: string,
  modifiedProject: string,
  updateLockOnly: boolean,
  workspaceRoot: string,
) {
  const deps = getDependents(projectName, workspace, workspaceRoot);

  for (const dep of deps) {
    console.log(chalk`\nUpdating project {bold ${dep}}`);
    const depConfig = workspace.projects[dep];

    updateProject(modifiedProject, depConfig.root, updateLockOnly);

    updateDependents(workspace, dep, modifiedProject, updateLockOnly, workspaceRoot);
  }
}
