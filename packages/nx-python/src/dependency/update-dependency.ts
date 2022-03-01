import { ExecutorContext, WorkspaceJsonConfiguration } from '@nrwl/devkit';
import chalk from 'chalk';
import { getDependents } from '../graph/dependency-graph';
import {
  getProjectTomlPath,
  parseToml,
  updateProject,
} from '../executors/utils/poetry';

export function updateDependencyTree(context: ExecutorContext) {
  const projectConfig = context.workspace.projects[context.projectName];
  const projectToml = getProjectTomlPath(projectConfig);
  const {
    tool: {
      poetry: { name },
    },
  } = parseToml(projectToml);

  updateDependents(context.workspace, context.projectName, name);
}

export function updateDependents(
  workspace: WorkspaceJsonConfiguration,
  projectName: string,
  modifiedProject: string
) {
  const deps = getDependents(projectName, workspace);

  for (const dep of deps) {
    console.log(chalk`\nUpdating project {bold ${dep}}`);
    const depConfig = workspace.projects[dep];

    updateProject(modifiedProject, depConfig.root);

    updateDependents(workspace, dep, modifiedProject);
  }
}
