import {
  Tree,
  getProjects,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nx/devkit';
import path from 'path';

export default function update(host: Tree) {
  for (const [projectName, data] of getProjects(host)) {
    const projectTomlPath = path.join(data.root, 'pyproject.toml');
    const projectConfigPath = path.join(data.root, 'project.json');

    if (host.exists(projectTomlPath) && host.exists(projectConfigPath)) {
      const projectConfig = readProjectConfiguration(host, projectName);

      if ('lock' in projectConfig.targets) {
        projectConfig.targets.lock.executor = '@nxlv/python:run-commands';
      }
      if ('test' in projectConfig.targets) {
        projectConfig.targets.test.executor = '@nxlv/python:run-commands';
      }

      updateProjectConfiguration(host, projectName, projectConfig);
    }
  }
}
