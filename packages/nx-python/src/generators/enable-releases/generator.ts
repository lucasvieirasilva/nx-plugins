import { getProjects, Tree, updateProjectConfiguration } from '@nx/devkit';
import path from 'path';

async function generator(host: Tree) {
  for (const project of getProjects(host)) {
    const [projectName, projectConfig] = project;
    const pyprojectTomlPath = path.join(projectConfig.root, 'pyproject.toml');
    if (host.exists(pyprojectTomlPath)) {
      projectConfig.release = projectConfig.release || {
        version: {
          generator: '@nxlv/python:release-version',
        },
      };

      updateProjectConfiguration(host, projectName, projectConfig);
    }
  }
}

export default generator;
