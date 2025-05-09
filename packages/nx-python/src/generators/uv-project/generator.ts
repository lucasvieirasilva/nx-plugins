import {
  addProjectConfiguration,
  formatFiles,
  ProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import * as path from 'path';
import { parse, stringify } from '@iarna/toml';
import chalk from 'chalk';
import _ from 'lodash';
import { UVPyprojectToml } from '../../provider/uv/types';
import { DEV_DEPENDENCIES_VERSION_MAP } from '../consts';
import {
  addFiles,
  normalizeOptions as baseNormalizeOptions,
  getDefaultPythonProjectTargets,
  getPyprojectTomlByProjectName,
  updateNxReleaseConfig,
} from '../utils';
import {
  BaseNormalizedSchema,
  BasePythonProjectGeneratorSchema,
} from '../types';
import { UVProvider } from '../../provider/uv';
import { BaseProvider } from '../../provider/base';
import { sortPreservingInsert, sortPreservingSet } from '../../utils/toml';

interface NormalizedSchema extends BaseNormalizedSchema {
  devDependenciesProjectPath?: string;
  devDependenciesProjectPkgName?: string;
  individualPackage: boolean;
}

function normalizeOptions(
  tree: Tree,
  options: BasePythonProjectGeneratorSchema,
): NormalizedSchema {
  const newOptions = baseNormalizeOptions(tree, options);

  let devDependenciesProjectPkgName: string | undefined;
  let devDependenciesProjectPath: string | undefined;
  if (options.devDependenciesProject) {
    const projectConfig = readProjectConfiguration(
      tree,
      options.devDependenciesProject,
    );
    const { pyprojectToml } = getPyprojectTomlByProjectName<UVPyprojectToml>(
      tree,
      options.devDependenciesProject,
    );
    devDependenciesProjectPkgName = pyprojectToml.project.name;
    devDependenciesProjectPath = path.relative(
      newOptions.projectRoot,
      projectConfig.root,
    );
  }

  return {
    ...newOptions,
    devDependenciesProject: options.devDependenciesProject ?? '',
    devDependenciesProjectPath,
    devDependenciesProjectPkgName,
    individualPackage: !tree.exists('pyproject.toml'),
  };
}

function updateRootPyprojectToml(
  tree: Tree,
  normalizedOptions: NormalizedSchema,
) {
  if (normalizedOptions.individualPackage) {
    return;
  }

  const rootPyprojectToml: UVPyprojectToml = parse(
    tree.read('./pyproject.toml', 'utf-8'),
  ) as UVPyprojectToml;

  const group = normalizedOptions.rootPyprojectDependencyGroup ?? 'main';

  if (group === 'main') {
    rootPyprojectToml.project.dependencies ??= [];
    sortPreservingInsert(
      rootPyprojectToml.project.dependencies,
      normalizedOptions.packageName,
    );
  } else {
    rootPyprojectToml['dependency-groups'] ??= {};
    rootPyprojectToml['dependency-groups'][group] ??= [];
    sortPreservingInsert(
      rootPyprojectToml['dependency-groups'][group],
      normalizedOptions.packageName,
    );
  }

  rootPyprojectToml.tool ??= {};
  rootPyprojectToml.tool.uv ??= {};
  rootPyprojectToml.tool.uv.sources ??= {};
  sortPreservingSet(
    rootPyprojectToml.tool.uv.sources,
    normalizedOptions.packageName,
    { workspace: true },
  );

  if (!normalizedOptions.devDependenciesProject) {
    rootPyprojectToml['dependency-groups'] ??= {};
    rootPyprojectToml['dependency-groups'].dev ??= [];

    const { changed, dependencies } = addTestDependencies(
      rootPyprojectToml['dependency-groups'].dev ?? [],
      normalizedOptions,
      true,
    );

    if (changed) {
      rootPyprojectToml['dependency-groups'].dev = dependencies;
    }
  }

  rootPyprojectToml.tool ??= {};
  rootPyprojectToml.tool.uv ??= {};
  rootPyprojectToml.tool.uv.workspace ??= {
    members: [],
  };

  sortPreservingInsert(
    rootPyprojectToml.tool.uv.workspace.members,
    normalizedOptions.projectRoot,
  );
  tree.write('./pyproject.toml', stringify(rootPyprojectToml));
}

function updateDevDependenciesProject(
  tree: Tree,
  normalizedOptions: NormalizedSchema,
) {
  if (normalizedOptions.devDependenciesProject) {
    const { pyprojectToml, pyprojectTomlPath } =
      getPyprojectTomlByProjectName<UVPyprojectToml>(
        tree,
        normalizedOptions.devDependenciesProject,
      );

    const { changed, dependencies } = addTestDependencies(
      pyprojectToml.project.dependencies,
      normalizedOptions,
      false,
    );

    if (changed) {
      pyprojectToml.project.dependencies = dependencies;

      tree.write(pyprojectTomlPath, stringify(pyprojectToml));
    }
  }
}

function addTestDependencies(
  dependencies: string[],
  normalizedOptions: NormalizedSchema,
  rootPyproject: boolean,
) {
  const newDependencies = [...dependencies];
  const dependencyNames = dependencies
    .map((dep) => /^[a-zA-Z0-9-]+/.exec(dep)?.[0])
    .filter((d) => !!d);

  if (
    normalizedOptions.linter === 'flake8' &&
    !dependencyNames.includes('flake8')
  ) {
    newDependencies.push(`flake8>=${DEV_DEPENDENCIES_VERSION_MAP.flake8}`);
  }

  if (
    normalizedOptions.linter === 'ruff' &&
    !dependencyNames.includes('ruff')
  ) {
    newDependencies.push(`ruff>=${DEV_DEPENDENCIES_VERSION_MAP.ruff}`);
  }

  if (
    !dependencyNames.includes('autopep8') &&
    ((rootPyproject && !normalizedOptions.devDependenciesProject) ||
      !rootPyproject)
  ) {
    newDependencies.push(`autopep8>=${DEV_DEPENDENCIES_VERSION_MAP.autopep8}`);
  }

  if (
    normalizedOptions.unitTestRunner === 'pytest' &&
    !dependencyNames.includes('pytest')
  ) {
    newDependencies.push(`pytest>=${DEV_DEPENDENCIES_VERSION_MAP.pytest}`);
  }
  if (
    normalizedOptions.unitTestRunner === 'pytest' &&
    !dependencyNames.includes('pytest-sugar')
  ) {
    newDependencies.push(
      `pytest-sugar>=${DEV_DEPENDENCIES_VERSION_MAP['pytest-sugar']}`,
    );
  }

  if (
    normalizedOptions.unitTestRunner === 'pytest' &&
    normalizedOptions.codeCoverage &&
    !dependencyNames.includes('pytest-cov')
  ) {
    newDependencies.push(
      `pytest-cov>=${DEV_DEPENDENCIES_VERSION_MAP['pytest-cov']}`,
    );
  }

  if (
    normalizedOptions.unitTestRunner === 'pytest' &&
    normalizedOptions.codeCoverageHtmlReport &&
    !dependencyNames.includes('pytest-html')
  ) {
    newDependencies.push(
      `pytest-html>=${DEV_DEPENDENCIES_VERSION_MAP['pytest-html']}`,
    );
  }

  return {
    changed: !_.isEqual(dependencies, newDependencies),
    dependencies: newDependencies,
  };
}

async function updateRootUvLock(tree: Tree, provider: BaseProvider) {
  if (tree.exists('pyproject.toml')) {
    console.log(chalk`  Updating root {bgBlue uv.lock}...`);
    await provider.install();
    console.log(chalk`\n  {bgBlue uv.lock} updated.\n`);
  }
}

export default async function (
  tree: Tree,
  options: BasePythonProjectGeneratorSchema,
) {
  const provider = new UVProvider(tree.root, undefined, tree);
  await provider.checkPrerequisites();

  const normalizedOptions = normalizeOptions(tree, options);

  const targets: ProjectConfiguration['targets'] = {
    ...(await getDefaultPythonProjectTargets(normalizedOptions, provider)),
    install: {
      executor: '@nxlv/python:install',
      options: {
        silent: false,
        args: '',
        verbose: false,
        debug: false,
      },
    },
  };

  const projectConfiguration: ProjectConfiguration = {
    root: normalizedOptions.projectRoot,
    projectType: normalizedOptions.projectType,
    sourceRoot: `${normalizedOptions.projectRoot}/${normalizedOptions.moduleName}`,
    targets,
    tags: normalizedOptions.parsedTags,
  };

  if (normalizedOptions.publishable) {
    projectConfiguration.targets ??= {};
    projectConfiguration.targets['nx-release-publish'] = {
      executor: '@nxlv/python:publish',
      options: {},
      outputs: [],
    };
  }

  updateNxReleaseConfig(normalizedOptions, projectConfiguration);

  addProjectConfiguration(
    tree,
    normalizedOptions.projectName,
    projectConfiguration,
  );

  addFiles(tree, normalizedOptions, __dirname);
  updateDevDependenciesProject(tree, normalizedOptions);
  updateRootPyprojectToml(tree, normalizedOptions);
  await formatFiles(tree);

  return async () => {
    await updateRootUvLock(tree, provider);
  };
}
