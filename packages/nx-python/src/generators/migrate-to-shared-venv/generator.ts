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
import chalk from 'chalk';
import { PoetryPyprojectToml } from '../../provider/poetry';
import { UVPyprojectToml } from '../../provider/uv/types';
import { getProvider } from '../../provider';
import { BaseProvider } from '../../provider/base';

async function addFiles(host: Tree, options: Schema) {
  const packageJson = await readJsonFile('package.json');

  const templateOptions = {
    ...options,
    template: '',
    dot: '.',
    packageName: packageJson.name,
    description: packageJson.description || '',
  };

  generateFiles(
    host,
    path.join(__dirname, 'files', 'base'),
    '.',
    templateOptions,
  );

  if (options.packageManager === 'poetry') {
    generateFiles(
      host,
      path.join(__dirname, 'files', 'poetry'),
      '.',
      templateOptions,
    );
  } else if (options.packageManager === 'uv') {
    generateFiles(
      host,
      path.join(__dirname, 'files', 'uv'),
      '.',
      templateOptions,
    );
  }
}

type LockUpdateTask = () => Promise<void>;

function updatePoetryPyprojectRoot(
  host: Tree,
  options: Schema,
  provider: BaseProvider,
): LockUpdateTask[] {
  const postGeneratorTasks = [];

  const rootPyprojectToml = parse(
    host.read('pyproject.toml').toString(),
  ) as PoetryPyprojectToml;

  for (const project of getProjects(host)) {
    const [, projectConfig] = project;
    const pyprojectTomlPath = path.join(projectConfig.root, 'pyproject.toml');
    if (host.exists(pyprojectTomlPath)) {
      const pyprojectToml = parse(
        host.read(pyprojectTomlPath).toString(),
      ) as PoetryPyprojectToml;

      rootPyprojectToml.tool.poetry.dependencies[
        pyprojectToml.tool.poetry.name
      ] = {
        path: projectConfig.root,
        develop: true,
      };
      if (options.moveDevDependencies) {
        postGeneratorTasks.push(
          movePoetryDevDependencies(
            pyprojectToml,
            rootPyprojectToml,
            host,
            pyprojectTomlPath,
            projectConfig,
            provider,
          ),
        );
      }
    }
  }

  host.write('pyproject.toml', stringify(rootPyprojectToml));

  return postGeneratorTasks;
}

function movePoetryDevDependencies(
  pyprojectToml: PoetryPyprojectToml,
  rootPyprojectToml: PoetryPyprojectToml,
  host: Tree,
  pyprojectTomlPath: string,
  projectConfig: ProjectConfiguration,
  provider: BaseProvider,
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

  return async () => {
    console.log(
      chalk`  Updating ${pyprojectToml.tool.poetry.name} {bgBlue poetry.lock}...`,
    );
    await provider.lock(projectConfig.root);
    console.log(chalk`\n  {bgBlue poetry.lock} updated.\n`);
  };
}

function updateUvPyprojectRoot(host: Tree, options: Schema): LockUpdateTask[] {
  const postGeneratorTasks = [];

  const rootPyprojectToml = parse(
    host.read('pyproject.toml').toString(),
  ) as UVPyprojectToml;

  for (const project of getProjects(host)) {
    const [, projectConfig] = project;
    const pyprojectTomlPath = path.join(projectConfig.root, 'pyproject.toml');
    if (host.exists(pyprojectTomlPath)) {
      const pyprojectToml = parse(
        host.read(pyprojectTomlPath).toString(),
      ) as UVPyprojectToml;

      rootPyprojectToml.project.dependencies.push(pyprojectToml.project.name);
      rootPyprojectToml.tool ??= {};
      rootPyprojectToml.tool.uv ??= {};
      rootPyprojectToml.tool.uv.sources ??= {};
      rootPyprojectToml.tool.uv.sources[pyprojectToml.project.name] = {
        workspace: true,
      };
      rootPyprojectToml.tool.uv.workspace ??= {
        members: [],
      };
      rootPyprojectToml.tool.uv.workspace.members.push(projectConfig.root);

      for (const source of Object.keys(pyprojectToml.tool?.uv?.sources ?? {})) {
        if (pyprojectToml.tool.uv.sources[source].path) {
          pyprojectToml.tool.uv.sources[source] = { workspace: true };
        }
      }

      if (options.moveDevDependencies) {
        moveUvDevDependencies(pyprojectToml, rootPyprojectToml);
      }

      host.write(pyprojectTomlPath, stringify(pyprojectToml));
      host.delete(path.join(projectConfig.root, 'uv.lock'));
      host.delete(path.join(projectConfig.root, '.venv'));
    }
  }

  host.write('pyproject.toml', stringify(rootPyprojectToml));

  return postGeneratorTasks;
}

function moveUvDevDependencies(
  pyprojectToml: UVPyprojectToml,
  rootPyprojectToml: UVPyprojectToml,
) {
  const devDependencies = pyprojectToml?.['dependency-groups']?.dev || [];
  rootPyprojectToml['dependency-groups'] ??= {};
  rootPyprojectToml['dependency-groups'].dev ??= [];

  for (const devDependency of devDependencies) {
    if (
      rootPyprojectToml['dependency-groups'].dev.some(
        (dep) =>
          /^[a-zA-Z0-9-]+/.exec(dep)?.[0] ===
          /^[a-zA-Z0-9-]+/.exec(devDependency)?.[0],
      )
    ) {
      continue;
    }
    rootPyprojectToml['dependency-groups'].dev.push(devDependency);
  }

  if (pyprojectToml['dependency-groups']?.dev?.length) {
    delete pyprojectToml['dependency-groups'].dev;
  }

  if (Object.keys(pyprojectToml['dependency-groups'] || {}).length === 0) {
    delete pyprojectToml['dependency-groups'];
  }
}

async function generator(host: Tree, options: Schema) {
  const provider = await getProvider(
    host.root,
    undefined,
    host,
    undefined,
    options,
  );

  await provider.checkPrerequisites();

  await addFiles(host, options);
  const lockUpdateTasks: LockUpdateTask[] = [];
  if (options.packageManager === 'poetry') {
    lockUpdateTasks.push(...updatePoetryPyprojectRoot(host, options, provider));
  } else if (options.packageManager === 'uv') {
    lockUpdateTasks.push(...updateUvPyprojectRoot(host, options));
  }

  await formatFiles(host);

  return async () => {
    for (const task of lockUpdateTasks) {
      await task();
    }

    await provider.install();
  };
}

export default generator;
