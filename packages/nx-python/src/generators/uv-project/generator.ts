import {
  addProjectConfiguration,
  formatFiles,
  generateFiles,
  names,
  offsetFromRoot,
  ProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import * as path from 'path';
import { parse, stringify } from '@iarna/toml';
import chalk from 'chalk';
import _ from 'lodash';
import { UVPyprojectToml } from '../../provider/uv/types';
import { checkUvExecutable, runUv } from '../../provider/uv/utils';
import { DEV_DEPENDENCIES_VERSION_MAP } from '../consts';
import {
  normalizeOptions as baseNormalizeOptions,
  getPyprojectTomlByProjectName,
} from '../utils';
import {
  BaseNormalizedSchema,
  BasePythonProjectGeneratorSchema,
} from '../types';

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

function addFiles(tree: Tree, options: NormalizedSchema) {
  const templateOptions = {
    ...options,
    ...names(options.name),
    offsetFromRoot: offsetFromRoot(options.projectRoot),
    template: '',
    dot: '.',
    versionMap: DEV_DEPENDENCIES_VERSION_MAP,
  };
  if (options.templateDir) {
    generateFiles(
      tree,
      path.join(options.templateDir),
      options.projectRoot,
      templateOptions,
    );
    return;
  }

  generateFiles(
    tree,
    path.join(__dirname, 'files', 'base'),
    options.projectRoot,
    templateOptions,
  );

  if (options.unitTestRunner === 'pytest') {
    generateFiles(
      tree,
      path.join(__dirname, 'files', 'pytest'),
      options.projectRoot,
      templateOptions,
    );
  }

  if (options.linter === 'flake8') {
    generateFiles(
      tree,
      path.join(__dirname, 'files', 'flake8'),
      options.projectRoot,
      templateOptions,
    );
  }
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
    rootPyprojectToml.project.dependencies.push(normalizedOptions.packageName);
  } else {
    rootPyprojectToml['dependency-groups'] ??= {};
    rootPyprojectToml['dependency-groups'][group] ??= [];
    rootPyprojectToml['dependency-groups'][group].push(
      normalizedOptions.packageName,
    );
  }

  rootPyprojectToml.tool ??= {};
  rootPyprojectToml.tool.uv ??= {};
  rootPyprojectToml.tool.uv.sources ??= {};
  rootPyprojectToml.tool.uv.sources[normalizedOptions.packageName] = {
    workspace: true,
  };

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

  rootPyprojectToml.tool.uv.workspace.members.push(
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

function updateRootUvLock(tree: Tree) {
  if (tree.exists('pyproject.toml')) {
    console.log(chalk`  Updating root {bgBlue uv.lock}...`);
    runUv(['sync'], { log: false });
    console.log(chalk`\n  {bgBlue uv.lock} updated.\n`);
  }
}

export default async function (
  tree: Tree,
  options: BasePythonProjectGeneratorSchema,
) {
  await checkUvExecutable();

  const normalizedOptions = normalizeOptions(tree, options);

  const targets: ProjectConfiguration['targets'] = {
    lock: {
      executor: '@nxlv/python:run-commands',
      options: {
        command: 'uv lock',
        cwd: normalizedOptions.projectRoot,
      },
    },
    add: {
      executor: '@nxlv/python:add',
      options: {},
    },
    update: {
      executor: '@nxlv/python:update',
      options: {},
    },
    remove: {
      executor: '@nxlv/python:remove',
      options: {},
    },
    build: {
      executor: '@nxlv/python:build',
      outputs: ['{projectRoot}/dist'],
      options: {
        outputPath: `${normalizedOptions.projectRoot}/dist`,
        publish: normalizedOptions.publishable,
        lockedVersions: normalizedOptions.buildLockedVersions,
        bundleLocalDependencies: normalizedOptions.buildBundleLocalDependencies,
      },
      cache: true,
    },
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

  if (options.linter === 'flake8') {
    targets.lint = {
      executor: '@nxlv/python:flake8',
      outputs: [
        `{workspaceRoot}/reports/${normalizedOptions.projectRoot}/pylint.txt`,
      ],
      options: {
        outputFile: `reports/${normalizedOptions.projectRoot}/pylint.txt`,
      },
      cache: true,
    };
  }

  if (options.linter === 'ruff') {
    targets.lint = {
      executor: '@nxlv/python:ruff-check',
      outputs: [],
      options: {
        lintFilePatterns: [normalizedOptions.moduleName].concat(
          options.unitTestRunner === 'pytest' ? ['tests'] : [],
        ),
      },
      cache: true,
    };
  }

  if (options.unitTestRunner === 'pytest') {
    targets.test = {
      executor: '@nxlv/python:run-commands',
      outputs: [
        `{workspaceRoot}/reports/${normalizedOptions.projectRoot}/unittests`,
        `{workspaceRoot}/coverage/${normalizedOptions.projectRoot}`,
      ],
      options: {
        command: `uv run pytest tests/`,
        cwd: normalizedOptions.projectRoot,
      },
      cache: true,
    };
  }

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

  projectConfiguration.release = {
    version: {
      generator: '@nxlv/python:release-version',
    },
  };

  addProjectConfiguration(
    tree,
    normalizedOptions.projectName,
    projectConfiguration,
  );

  addFiles(tree, normalizedOptions);
  updateDevDependenciesProject(tree, normalizedOptions);
  updateRootPyprojectToml(tree, normalizedOptions);
  await formatFiles(tree);

  return () => {
    updateRootUvLock(tree);
  };
}
