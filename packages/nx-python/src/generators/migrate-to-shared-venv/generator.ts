import {
  readJsonFile,
  formatFiles,
  generateFiles,
  getProjects,
  Tree,
} from '@nrwl/devkit';
import path from 'path';
import { Schema } from './schema';
import { parse, stringify } from '@iarna/toml';
import { PyprojectToml } from '../../graph/dependency-graph';
import spawn from 'cross-spawn';
import chalk from 'chalk';

async function addFiles(host: Tree) {
  const packageJson = await readJsonFile('package.json');

  const templateOptions = {
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
        const devDependencies =
          pyprojectToml.tool.poetry.group?.dev?.dependencies || {};

        for (const devDependency of Object.keys(devDependencies)) {
          rootPyprojectToml.tool.poetry.group = rootPyprojectToml.tool.poetry.group || {};
          rootPyprojectToml.tool.poetry.group.dev = rootPyprojectToml.tool.poetry.group.dev || { dependencies: {} };
          rootPyprojectToml.tool.poetry.group.dev.dependencies[devDependency] =
            devDependencies[devDependency];
        }

        if (Object.keys(devDependencies).length > 0) {
          delete pyprojectToml.tool.poetry.group.dev
        }
        host.write(pyprojectTomlPath, stringify(pyprojectToml));

        postGeneratorTasks.push(() => {
          console.log(
            chalk`  Updating ${pyprojectToml.tool.poetry.name} {bgBlue poetry.lock}...`
          );
          const executable = 'poetry';
          const lockArgs = ['lock', '--no-update'];
          spawn.sync(executable, lockArgs, {
            shell: false,
            stdio: 'inherit',
            cwd: projectConfig.root,
          });
          console.log(chalk`\n  {bgBlue poetry.lock} updated.\n`);
        });
      }
    }
  }

  host.write('pyproject.toml', stringify(rootPyprojectToml));

  return postGeneratorTasks;
}

function updateRootPoetryLock() {
  console.log(chalk`  Updating root {bgBlue poetry.lock}...`);
  const executable = 'poetry';
  const updateArgs = ['install'];
  spawn.sync(executable, updateArgs, {
    shell: false,
    stdio: 'inherit',
  });
  console.log(chalk`\n  {bgBlue poetry.lock} updated.\n`);
}

async function generator(host: Tree, options: Schema) {
  await addFiles(host);
  const lockUpdateTasks = updatePyprojectRoot(host, options);
  await formatFiles(host);

  return () => {
    lockUpdateTasks.forEach((task) => task());
    updateRootPoetryLock();
  };
}

export default generator;
