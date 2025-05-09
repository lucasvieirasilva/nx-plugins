import { getProjects, Tree, updateProjectConfiguration } from '@nx/devkit';
import path from 'path';
import { updateNxReleaseConfig } from '../utils';
import { Schema } from './schema';

async function generator(host: Tree, options: Schema) {
  for (const project of getProjects(host)) {
    const [projectName, projectConfig] = project;
    const pyprojectTomlPath = path.join(projectConfig.root, 'pyproject.toml');
    if (host.exists(pyprojectTomlPath)) {
      updateNxReleaseConfig(options, projectConfig);
      updateProjectConfiguration(host, projectName, projectConfig);
    }
  }
}

export default generator;
