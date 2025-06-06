import {
  generateFiles,
  getWorkspaceLayout,
  names,
  offsetFromRoot,
  ProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import {
  BasePythonProjectGeneratorSchema,
  PytestGeneratorSchema,
  BaseNormalizedSchema,
} from './types';
import spawn from 'cross-spawn';
import _ from 'lodash';
import path from 'path';
import { parse } from '@iarna/toml';
import { DEV_DEPENDENCIES_VERSION_MAP } from './consts';
import { BaseProvider } from '../provider/base';

export function getPyTestAddopts(
  options: PytestGeneratorSchema,
  projectRoot: string,
): string | undefined {
  if (options.unitTestRunner === 'pytest') {
    const args = [];
    const offset = offsetFromRoot(projectRoot);
    if (options.codeCoverage) {
      args.push(' --cov');
    }
    if (options.codeCoverageThreshold) {
      args.push(` --cov-fail-under=${options.codeCoverageThreshold}`);
    }
    if (options.codeCoverage && options.codeCoverageHtmlReport) {
      args.push(` --cov-report html:'${offset}coverage/${projectRoot}/html'`);
    }

    if (options.codeCoverage && options.codeCoverageXmlReport) {
      args.push(
        ` --cov-report xml:'${offset}coverage/${projectRoot}/coverage.xml'`,
      );
    }

    if (options.unitTestHtmlReport) {
      args.push(
        ` --html='${offset}reports/${projectRoot}/unittests/html/index.html'`,
      );
    }

    if (options.unitTestJUnitReport) {
      args.push(
        ` --junitxml='${offset}reports/${projectRoot}/unittests/junit.xml'`,
      );
    }

    if (args.length === 0) {
      return '';
    }

    return `\n${args.join('\n')}\n`;
  }
}

export function calculateProjectNameAndRoot(
  options: BasePythonProjectGeneratorSchema,
  tree: Tree,
) {
  let projectName = options.name;
  let projectRoot = options.directory || options.name;

  if (options.projectNameAndRootFormat === 'derived') {
    const name = names(options.name).fileName;
    const projectDirectory = options.directory
      ? `${names(options.directory).fileName}/${name}`
      : name;
    projectName = projectDirectory.replace(/\//g, '-');
    projectRoot = `${
      options.projectType === 'application'
        ? getWorkspaceLayout(tree).appsDir
        : getWorkspaceLayout(tree).libsDir
    }/${projectDirectory}`;
  }

  return { projectName, projectRoot };
}

export function normalizeOptions(
  tree: Tree,
  options: BasePythonProjectGeneratorSchema,
): BaseNormalizedSchema {
  const { projectName, projectRoot } = calculateProjectNameAndRoot(
    options,
    tree,
  );

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const newOptions = _.clone(options) as BaseNormalizedSchema;

  if (!options.pyprojectPythonDependency) {
    newOptions.pyprojectPythonDependency = '>=3.9,<4';
  }

  if (!options.pyenvPythonVersion) {
    const result = spawn.sync('python', ['--version'], {
      stdio: 'pipe',
    });

    newOptions.pyenvPythonVersion =
      result.status === 0
        ? result.stdout.toString('utf-8').replace('Python ', '').trim()
        : '3.9.5';
  }

  if (!options.moduleName) {
    newOptions.moduleName = projectName.replace(/-/g, '_');
  }

  if (!options.packageName) {
    newOptions.packageName = projectName;
  }

  if (!options.description) {
    newOptions.description = 'Automatically generated by Nx.';
  }

  const pythonAddopts = getPyTestAddopts(options, projectRoot);

  if (options.unitTestRunner === 'none') {
    newOptions.unitTestHtmlReport = false;
    newOptions.unitTestJUnitReport = false;
    newOptions.codeCoverage = false;
    newOptions.codeCoverageHtmlReport = false;
    newOptions.codeCoverageXmlReport = false;
    newOptions.codeCoverageThreshold = undefined;
  }

  return {
    ...options,
    ...newOptions,
    devDependenciesProject: options.devDependenciesProject || '',
    pythonAddopts,
    projectName,
    projectRoot,
    parsedTags,
  };
}

export function getPyprojectTomlByProjectName<T>(
  tree: Tree,
  projectName: string,
) {
  const projectConfig = readProjectConfiguration(tree, projectName);
  const pyprojectTomlPath = path.join(projectConfig.root, 'pyproject.toml');

  const pyprojectToml = parse(tree.read(pyprojectTomlPath, 'utf-8')) as T;

  return { pyprojectToml, pyprojectTomlPath };
}

export function addFiles(
  tree: Tree,
  options: BaseNormalizedSchema,
  generatorBaseDir: string,
) {
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
    path.join(generatorBaseDir, 'files', 'base'),
    options.projectRoot,
    templateOptions,
  );

  if (options.unitTestRunner === 'pytest') {
    generateFiles(
      tree,
      path.join(generatorBaseDir, 'files', 'pytest'),
      options.projectRoot,
      templateOptions,
    );
  }

  if (options.linter === 'flake8') {
    generateFiles(
      tree,
      path.join(generatorBaseDir, 'files', 'flake8'),
      options.projectRoot,
      templateOptions,
    );
  }
}

export async function updateNxReleaseConfig(
  options: Pick<BaseNormalizedSchema, 'useNxReleaseLegacyVersioning'>,
  projectConfiguration: ProjectConfiguration,
) {
  if (options.useNxReleaseLegacyVersioning) {
    projectConfiguration.release = {
      version: {
        generator: '@nxlv/python:release-version',
      },
    };
  } else {
    projectConfiguration.release = {
      version: {
        versionActions: '@nxlv/python/src/release/version-actions',
      },
    };
  }

  return projectConfiguration;
}

export async function getDefaultPythonProjectTargets(
  options: BaseNormalizedSchema,
  provider: BaseProvider,
): Promise<ProjectConfiguration['targets']> {
  const targets: ProjectConfiguration['targets'] = {
    lock: {
      executor: '@nxlv/python:lock',
      options: {
        update: false,
      },
    },
    sync: {
      executor: '@nxlv/python:sync',
      options: {},
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
        outputPath: `{projectRoot}/dist`,
        publish: options.publishable,
        lockedVersions: options.buildLockedVersions,
        bundleLocalDependencies: options.buildBundleLocalDependencies,
      },
      cache: true,
    },
  };

  if (options.linter === 'flake8') {
    targets.lint = {
      executor: '@nxlv/python:flake8',
      outputs: [`{workspaceRoot}/reports/{projectRoot}/pylint.txt`],
      options: {
        outputFile: `reports/{projectRoot}/pylint.txt`,
      },
      cache: true,
    };
  }

  if (options.linter === 'ruff') {
    targets.lint = {
      executor: '@nxlv/python:ruff-check',
      outputs: [],
      options: {
        lintFilePatterns: [options.moduleName].concat(
          options.unitTestRunner === 'pytest' ? ['tests'] : [],
        ),
      },
      cache: true,
    };

    targets.format = {
      executor: '@nxlv/python:ruff-format',
      outputs: [],
      options: {
        filePatterns: [options.moduleName].concat(
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
        `{workspaceRoot}/reports/{projectRoot}/unittests`,
        `{workspaceRoot}/coverage/{projectRoot}`,
      ],
      options: {
        command: await provider.getRunCommand(['pytest', 'tests/']),
        cwd: '{projectRoot}',
      },
      cache: true,
    };
  }

  return targets;
}
