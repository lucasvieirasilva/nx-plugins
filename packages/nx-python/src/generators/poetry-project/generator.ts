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
import {
  PoetryPyprojectToml,
  PoetryPyprojectTomlDependencies,
} from '../../provider/poetry';
import { checkPoetryExecutable, runPoetry } from '../../provider/poetry/utils';
import {
  BaseNormalizedSchema,
  BasePythonProjectGeneratorSchema,
} from '../types';
import {
  normalizeOptions as baseNormalizeOptions,
  getPyprojectTomlByProjectName,
} from '../utils';
import { DEV_DEPENDENCIES_VERSION_MAP } from '../consts';

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
  host: Tree,
  normalizedOptions: NormalizedSchema,
) {
  if (!normalizedOptions.individualPackage) {
    const rootPyprojectToml = parse(
      host.read('./pyproject.toml', 'utf-8'),
    ) as PoetryPyprojectToml;

    const group = normalizedOptions.rootPyprojectDependencyGroup ?? 'main';

    if (group === 'main') {
      rootPyprojectToml.tool.poetry.dependencies[
        normalizedOptions.packageName
      ] = {
        path: normalizedOptions.projectRoot,
        develop: true,
      };
    } else {
      rootPyprojectToml.tool.poetry.group = {
        ...(rootPyprojectToml.tool.poetry.group || {}),
        [group]: {
          ...(rootPyprojectToml.tool.poetry.group?.[group] || {}),
          dependencies: {
            ...(rootPyprojectToml.tool.poetry.group?.[group]?.dependencies ||
              {}),
            [normalizedOptions.packageName]: {
              path: normalizedOptions.projectRoot,
              develop: true,
            },
          },
        },
      };
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

function updateRootPoetryLock(host: Tree) {
  if (host.exists('./pyproject.toml')) {
    console.log(chalk`  Updating root {bgBlue poetry.lock}...`);
    runPoetry(['lock', '--no-update'], { log: false });
    runPoetry(['install']);
    console.log(chalk`\n  {bgBlue poetry.lock} updated.\n`);
  }
}

export default async function (
  tree: Tree,
  options: BasePythonProjectGeneratorSchema,
) {
  await checkPoetryExecutable();

  const normalizedOptions = normalizeOptions(tree, options);

  const targets: ProjectConfiguration['targets'] = {
    lock: {
      executor: '@nxlv/python:run-commands',
      options: {
        command: 'poetry lock --no-update',
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
    },
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

  if (options.linter === 'flake8') {
    targets.lint = {
      executor: '@nxlv/python:flake8',
      outputs: [
        `{workspaceRoot}/reports/${normalizedOptions.projectRoot}/pylint.txt`,
      ],
      options: {
        outputFile: `reports/${normalizedOptions.projectRoot}/pylint.txt`,
      },
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
        command: `poetry run pytest tests/`,
        cwd: normalizedOptions.projectRoot,
      },
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
    updateRootPoetryLock(tree);
  };
}
