import {
  addProjectConfiguration,
  formatFiles,
  generateFiles,
  getWorkspaceLayout,
  names,
  offsetFromRoot,
  Tree,
} from '@nrwl/devkit';
import path from 'path';
import { Schema } from './schema';
import { parse, stringify } from '@iarna/toml';
import { PyprojectToml } from '../../graph/dependency-graph';
import chalk from 'chalk';
import { checkPoetryExecutable, runPoetry } from '../../executors/utils/poetry';

export interface NormalizedSchema extends Schema {
  projectName: string;
  projectRoot: string;
  moduleName: string;
  projectDirectory: string;
  parsedTags: string[];
}

export function normalizeOptions(
  host: Tree,
  options: Schema
): NormalizedSchema {
  const name = names(options.name).fileName;
  const projectDirectory = options.directory
    ? `${names(options.directory).fileName}/${name}`
    : name;
  const projectName = projectDirectory.replace(new RegExp('/', 'g'), '-');
  const moduleName = options.moduleName
    ? options.moduleName
    : projectName.replace(new RegExp('-', 'g'), '_');

  let projectRoot = '';

  if (options.type === 'application') {
    projectRoot = `${getWorkspaceLayout(host).appsDir}/${projectDirectory}`;
  } else {
    projectRoot = `${getWorkspaceLayout(host).libsDir}/${projectDirectory}`;
  }
  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  return {
    ...options,
    description: options.description ?? '',
    moduleName,
    projectName,
    projectRoot,
    projectDirectory,
    parsedTags,
  };
}

function addFiles(host: Tree, options: NormalizedSchema) {
  const templateOptions = {
    ...options,
    ...names(options.name),
    offsetFromRoot: offsetFromRoot(options.projectRoot),
    template: '',
    dot: '.',
  };

  generateFiles(
    host,
    path.join(__dirname, 'files'),
    options.projectRoot,
    templateOptions
  );
}

function addPackageSource(normalizedOptions: NormalizedSchema, host: Tree) {
  if (normalizedOptions.customSource) {
    if (!normalizedOptions.sourceName || !normalizedOptions.sourceUrl) {
      throw new Error(
        "Fields 'sourceName', 'sourceUrl' are required when the flag 'customSource' is true"
      );
    }

    const pyprojectTomlPath = path.join(
      normalizedOptions.projectRoot,
      'pyproject.toml'
    );

    const pyprojectTomlContent = host.read(pyprojectTomlPath).toString('utf-8');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pyprojectToml = parse(pyprojectTomlContent) as any;

    pyprojectToml.tool.poetry.source = [
      {
        name: normalizedOptions.sourceName,
        url: normalizedOptions.sourceUrl,
        secondary: normalizedOptions.sourceSecondary,
      },
    ];

    host.write(pyprojectTomlPath, stringify(pyprojectToml));
  }
}

function updateRootPyprojectToml(
  host: Tree,
  normalizedOptions: NormalizedSchema
) {
  if (host.exists('./pyproject.toml')) {
    const rootPyprojectToml = parse(
      host.read('pyproject.toml', 'utf-8')
    ) as PyprojectToml;
    rootPyprojectToml.tool.poetry.dependencies[normalizedOptions.packageName] =
      {
        path: normalizedOptions.projectRoot,
        develop: true,
      };
    host.write('pyproject.toml', stringify(rootPyprojectToml));
  }
}

function updateRootPoetryLock(host: Tree, normalizedOptions: NormalizedSchema) {
  if (host.exists('./pyproject.toml')) {
    console.log(chalk`  Updating root {bgBlue poetry.lock}...`);
    const updateArgs = ['update', normalizedOptions.packageName];
    runPoetry(updateArgs, { log: false });
    console.log(chalk`\n  {bgBlue poetry.lock} updated.\n`);
  }
}

async function generator(host: Tree, options: Schema) {
  await checkPoetryExecutable();

  const normalizedOptions = normalizeOptions(host, options);
  addProjectConfiguration(host, normalizedOptions.projectName, {
    root: normalizedOptions.projectRoot,
    projectType: normalizedOptions.type,
    sourceRoot: `${normalizedOptions.projectRoot}/${normalizedOptions.moduleName}`,
    targets: {
      docs: {
        executor: 'nx:run-commands',
        options: {
          command: `pydoc-markdown -p ${normalizedOptions.moduleName} --render-toc > docs/source/api.md`,
          cwd: normalizedOptions.projectRoot,
        },
      },
      lock: {
        executor: 'nx:run-commands',
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
        outputs: [`${normalizedOptions.projectRoot}/dist`],
        options: {
          outputPath: `${normalizedOptions.projectRoot}/dist`,
          publish: normalizedOptions.publishable,
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
      lint: {
        executor: '@nxlv/python:flake8',
        outputs: [`reports/${normalizedOptions.projectRoot}/pylint.txt`],
        options: {
          outputFile: `reports/${normalizedOptions.projectRoot}/pylint.txt`,
        },
      },
      test: {
        executor: 'nx:run-commands',
        outputs: [
          `reports/${normalizedOptions.projectRoot}/unittests`,
          `coverage/${normalizedOptions.projectRoot}`,
        ],
        options: {
          command: `poetry run pytest tests/`,
          cwd: normalizedOptions.projectRoot,
        },
      },
      tox: {
        executor: '@nxlv/python:tox',
        outputs: [
          `reports/${normalizedOptions.projectRoot}/unittests`,
          `coverage/${normalizedOptions.projectRoot}`,
        ],
        options: {
          silent: false,
          args: '',
        },
      },
    },
    tags: normalizedOptions.parsedTags,
  });
  addFiles(host, normalizedOptions);
  updateRootPyprojectToml(host, normalizedOptions);

  addPackageSource(normalizedOptions, host);

  await formatFiles(host);

  return () => {
    updateRootPoetryLock(host, normalizedOptions);
  };
}

export default generator;
