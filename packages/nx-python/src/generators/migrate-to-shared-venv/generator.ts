import {
  readJsonFile,
  formatFiles,
  generateFiles,
  getProjects,
  Tree,
  ProjectConfiguration,
} from '@nx/devkit';
import path from 'path';
import { Schema } from './schema';
import { parse, stringify } from '@iarna/toml';
import { PyprojectToml } from '../../graph/dependency-graph';
import chalk from 'chalk';
import { checkPoetryExecutable, runPoetry } from '../../executors/utils/poetry';

async function addFiles(host: Tree, options: Schema) {
  const packageJson = await readJsonFile('package.json');

  const templateOptions = {
    ...options,
    template: '',
    dot: '.',
    packageName: packageJson.name,
    description: packageJson.description || '',
  };

  generateFiles(host, path.join(__dirname, 'files'), '.', templateOptions);
}

type LockUpdateTask = () => void;

function updatePyprojectRoot(host: Tree, options: Schema): LockUpdateTask[] {
  const postGeneratorTasks = [];

  const rootPyprojectToml = parse(
    host.read('pyproject.toml').toString()
  ) as PyprojectToml;

  for (const project of getProjects(host)) {
    const [, projectConfig] = project;
    const pyprojectTomlPath = path.join(projectConfig.root, 'pyproject.toml');
    if (host.exists(pyprojectTomlPath)) {
      const pyprojectToml = parse(
        host.read(pyprojectTomlPath).toString()
      ) as PyprojectToml;

      rootPyprojectToml.tool.poetry.dependencies[
        pyprojectToml.tool.poetry.name
      ] = {
        path: projectConfig.root,
        develop: true,
      };
      if (options.moveDevDependencies) {
        postGeneratorTasks.push(
          moveDevDependencies(
            pyprojectToml,
            rootPyprojectToml,
            host,
            pyprojectTomlPath,
            projectConfig
          )
        );
      }
    }
  }

  host.write('pyproject.toml', stringify(rootPyprojectToml));

  return postGeneratorTasks;
}

function moveDevDependencies(
  pyprojectToml: PyprojectToml,
  rootPyprojectToml: PyprojectToml,
  host: Tree,
  pyprojectTomlPath: string,
  projectConfig: ProjectConfiguration
) {
  const devDependencies =
    pyprojectToml.tool.poetry.group?.dev?.dependencies || {};

  for (const devDependency of Object.keys(devDependencies)) {
    rootPyprojectToml.tool.poetry.group =
      rootPyprojectToml.tool.poetry.group || {};
    rootPyprojectToml.tool.poetry.group.dev = rootPyprojectToml.tool.poetry
      .group.dev || { dependencies: {} };
    rootPyprojectToml.tool.poetry.group.dev.dependencies[devDependency] =
      devDependencies[devDependency];
  }

  if (Object.keys(devDependencies).length > 0) {
    delete pyprojectToml.tool.poetry.group.dev;
  }
  host.write(pyprojectTomlPath, stringify(pyprojectToml));

  return () => {
    console.log(
      chalk`  Updating ${pyprojectToml.tool.poetry.name} {bgBlue poetry.lock}...`
    );
    const lockArgs = ['lock', '--no-update'];
    runPoetry(lockArgs, { cwd: projectConfig.root, log: false });
    console.log(chalk`\n  {bgBlue poetry.lock} updated.\n`);
  };
}

function updateRootPoetryLock() {
  console.log(chalk`  Updating root {bgBlue poetry.lock}...`);
  runPoetry(['install'], { log: false });
  console.log(chalk`\n  {bgBlue poetry.lock} updated.\n`);
}

async function generator(host: Tree, options: Schema) {
  await checkPoetryExecutable();

  await addFiles(host, options);
  const lockUpdateTasks = updatePyprojectRoot(host, options);
  await formatFiles(host);

  return () => {
    lockUpdateTasks.forEach((task) => task());
    updateRootPoetryLock();
  };
}

export default generator;
