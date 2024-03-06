import { toKebabCase } from '@nxlv/util';
import {
  updateProjectConfiguration,
  formatFiles,
  generateFiles,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import path from 'path';
import { MigrationGeneratorSchema } from './schema';
import { globSync } from 'glob';
import { LifecycleHook } from '../../migrator';

function normalizeOptions(options: MigrationGeneratorSchema) {
  return {
    ...options,
    description: options.description || '',
    name: toKebabCase(options.name),
  };
}

function addFiles(
  tree: Tree,
  projectRoot: string,
  options: MigrationGeneratorSchema,
) {
  const date = new Date();
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const formattedDate = `${year}${month}${day}`;
  const { filename, version } = getMigrationFilename(
    tree,
    projectRoot,
    options,
    formattedDate,
  );

  const templateOptions = {
    ...options,
    filename,
    ext: 'ts',
    version,
    lifecycleHook:
      options.lifecycleHook === LifecycleHook.BEFORE_DEPLOY
        ? 'BEFORE_DEPLOY'
        : 'AFTER_DEPLOY',
    template: '',
    dot: '.',
  };

  generateFiles(
    tree,
    path.join(__dirname, 'files', options.migrationProvider),
    path.join(
      projectRoot,
      options.migrationsDir,
      options.namespace,
      options.lifecycleHook === LifecycleHook.AFTER_DEPLOY ? 'post-deploy' : '',
    ),
    templateOptions,
  );

  if (options.addStream) {
    generateFiles(
      tree,
      path.join(__dirname, 'files', 'stream'),
      path.join(
        projectRoot,
        options.migrationsDir,
        options.namespace,
        options.lifecycleHook === LifecycleHook.AFTER_DEPLOY
          ? 'post-deploy'
          : '',
      ),
      templateOptions,
    );
  }
}

function getMigrationFilename(
  tree: Tree,
  projectRoot: string,
  options: MigrationGeneratorSchema,
  formattedDate: string,
  versionSeq = 1,
) {
  const version = parseInt(`${formattedDate}${versionSeq}`);
  const filename = `${formattedDate}${versionSeq}-${options.name}`;
  const baseFolder = path.join(
    projectRoot,
    options.migrationsDir,
    options.namespace,
  );

  const exists =
    globSync(path.join(baseFolder, `**/${version}-*.ts`)).length > 0;
  if (exists) {
    return getMigrationFilename(
      tree,
      projectRoot,
      options,
      formattedDate,
      versionSeq + 1,
    );
  }

  return { filename, version };
}

export default async function (tree: Tree, options: MigrationGeneratorSchema) {
  const normalizedOptions = normalizeOptions(options);

  const projectConfig = readProjectConfiguration(
    tree,
    normalizedOptions.project,
  );

  if ('migrate' in projectConfig.targets === false) {
    projectConfig.targets.migrate = {
      executor: '@nxlv/data-migration:migrate',
      options: {
        cwd: projectConfig.root,
        migrationsDir: normalizedOptions.migrationsDir,
      },
    };

    updateProjectConfiguration(tree, normalizedOptions.project, projectConfig);
  }
  if ('migrate-rollback' in projectConfig.targets === false) {
    projectConfig.targets['migrate-rollback'] = {
      executor: '@nxlv/data-migration:rollback',
      options: {
        cwd: projectConfig.root,
        migrationsDir: normalizedOptions.migrationsDir,
      },
    };

    updateProjectConfiguration(tree, normalizedOptions.project, projectConfig);
  }

  normalizedOptions.migrationsDir =
    projectConfig.targets.migrate.options.migrationsDir;

  addFiles(tree, projectConfig.root, normalizedOptions);

  await formatFiles(tree);
}
