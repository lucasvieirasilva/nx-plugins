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
import {
  PoetryProvider,
  PoetryPyprojectToml,
  PoetryPyprojectTomlDependencies,
} from '../../provider/poetry';
import {
  BaseNormalizedSchema,
  BasePythonProjectGeneratorSchema,
} from '../types';
import {
  addFiles,
  normalizeOptions as baseNormalizeOptions,
  getDefaultPythonProjectTargets,
  getPyprojectTomlByProjectName,
  updateNxReleaseConfig,
} from '../utils';
import { DEV_DEPENDENCIES_VERSION_MAP } from '../consts';
import { BaseProvider } from '../../provider/base';
import { sortPreservingSet } from '../../utils/toml';

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
    const { pyprojectToml } =
      getPyprojectTomlByProjectName<PoetryPyprojectToml>(
        tree,
        options.devDependenciesProject,
      );
    devDependenciesProjectPkgName = pyprojectToml.tool.poetry.name;
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
  host: Tree,
  normalizedOptions: NormalizedSchema,
) {
  if (!normalizedOptions.individualPackage) {
    const rootPyprojectToml = parse(
      host.read('./pyproject.toml', 'utf-8'),
    ) as PoetryPyprojectToml;

    const group = normalizedOptions.rootPyprojectDependencyGroup ?? 'main';

    if (group === 'main') {
      sortPreservingSet(
        rootPyprojectToml.tool.poetry.dependencies,
        normalizedOptions.packageName,
        { path: normalizedOptions.projectRoot, develop: true },
      );
    } else {
      rootPyprojectToml.tool.poetry.group ??= {};
      rootPyprojectToml.tool.poetry.group[group] ??= { dependencies: {} };
      sortPreservingSet(
        rootPyprojectToml.tool.poetry.group[group].dependencies,
        normalizedOptions.packageName,
        { path: normalizedOptions.projectRoot, develop: true },
      );
    }

    if (!normalizedOptions.devDependenciesProject) {
      const { changed, dependencies } = addTestDependencies(
        rootPyprojectToml.tool.poetry.group?.dev?.dependencies || {},
        normalizedOptions,
      );

      if (changed) {
        rootPyprojectToml.tool.poetry.group = {
          ...(rootPyprojectToml.tool.poetry.group || {}),
          dev: {
            dependencies: dependencies,
          },
        };
      }
    }

    host.write('./pyproject.toml', stringify(rootPyprojectToml));
  }
}

function updateDevDependenciesProject(
  host: Tree,
  normalizedOptions: NormalizedSchema,
) {
  if (normalizedOptions.devDependenciesProject) {
    const { pyprojectToml, pyprojectTomlPath } =
      getPyprojectTomlByProjectName<PoetryPyprojectToml>(
        host,
        normalizedOptions.devDependenciesProject,
      );

    const { changed, dependencies } = addTestDependencies(
      pyprojectToml.tool.poetry.dependencies,
      normalizedOptions,
    );

    if (changed) {
      pyprojectToml.tool.poetry.dependencies = {
        ...pyprojectToml.tool.poetry.dependencies,
        ...dependencies,
      };

      host.write(pyprojectTomlPath, stringify(pyprojectToml));
    }
  }
}

function addTestDependencies(
  dependencies: PoetryPyprojectTomlDependencies,
  normalizedOptions: NormalizedSchema,
) {
  const originalDependencies = _.clone(dependencies);

  if (normalizedOptions.linter === 'flake8' && !dependencies['flake8']) {
    dependencies['flake8'] = DEV_DEPENDENCIES_VERSION_MAP.flake8;
  }

  if (normalizedOptions.linter === 'ruff' && !dependencies['ruff']) {
    dependencies['ruff'] = DEV_DEPENDENCIES_VERSION_MAP.ruff;
  }

  if (!dependencies['autopep8']) {
    dependencies['autopep8'] = DEV_DEPENDENCIES_VERSION_MAP.autopep8;
  }

  if (
    normalizedOptions.unitTestRunner === 'pytest' &&
    !dependencies['pytest']
  ) {
    dependencies['pytest'] = DEV_DEPENDENCIES_VERSION_MAP.pytest;
  }
  if (
    normalizedOptions.unitTestRunner === 'pytest' &&
    !dependencies['pytest-sugar']
  ) {
    dependencies['pytest-sugar'] = DEV_DEPENDENCIES_VERSION_MAP['pytest-sugar'];
  }

  if (
    normalizedOptions.unitTestRunner === 'pytest' &&
    normalizedOptions.codeCoverage &&
    !dependencies['pytest-cov']
  ) {
    dependencies['pytest-cov'] = DEV_DEPENDENCIES_VERSION_MAP['pytest-cov'];
  }

  if (
    normalizedOptions.unitTestRunner === 'pytest' &&
    normalizedOptions.codeCoverageHtmlReport &&
    !dependencies['pytest-html']
  ) {
    dependencies['pytest-html'] = DEV_DEPENDENCIES_VERSION_MAP['pytest-html'];
  }

  return {
    changed: !_.isEqual(originalDependencies, dependencies),
    dependencies,
  };
}

async function updateRootPoetryLock(tree: Tree, provider: BaseProvider) {
  if (tree.exists('./pyproject.toml')) {
    console.log(chalk`  Updating root {bgBlue poetry.lock}...`);
    await provider.lock();
    await provider.install();
    console.log(chalk`\n  {bgBlue poetry.lock} updated.\n`);
  }
}

export default async function (
  tree: Tree,
  options: BasePythonProjectGeneratorSchema,
) {
  const provider = new PoetryProvider(tree.root, undefined, tree);
  await provider.checkPrerequisites();

  const normalizedOptions = normalizeOptions(tree, options);

  const targets: ProjectConfiguration['targets'] = {
    ...(await getDefaultPythonProjectTargets(normalizedOptions, provider)),
    install: {
      executor: '@nxlv/python:install',
      options: {
        silent: false,
        args: '',
        cacheDir: `.cache/pypoetry`,
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
    await updateRootPoetryLock(tree, provider);
  };
}
