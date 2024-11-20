import { vi } from 'vitest';

const globSync = vi.hoisted(() => vi.fn().mockReturnValue([]));
vi.mock('glob', () => ({ globSync }));

import { libraryGenerator } from '@nx/js';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  Tree,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nx/devkit';

import generator from './generator';
import { MigrationGeneratorSchema } from './schema';
import { LifecycleHook } from '../../migrator';

describe('migration generator', () => {
  let appTree: Tree;
  const options: MigrationGeneratorSchema = {
    name: 'migration-name',
    project: 'test',
    namespace: 'namespace',
    migrationsDir: 'src/migrations',
    addStream: false,
    lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
    migrationProvider: 'standard',
    parentVersion: undefined,
    baseline: false,
  };

  beforeEach(async () => {
    appTree = createTreeWithEmptyWorkspace({
      layout: 'apps-libs',
    });

    await libraryGenerator(appTree, {
      name: 'test',
      tags: 'scope:test,type:lib',
      directory: 'libs/test',
    });

    vi.useFakeTimers().setSystemTime(new Date('2023-01-01 12:00:00').getTime());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should run successfully', async () => {
    await generator(appTree, options);

    const projectConfig = readProjectConfiguration(appTree, 'test');
    expect(projectConfig.targets.migrate).toBeDefined();
    expect(projectConfig.targets.migrate.executor).toEqual(
      '@nxlv/data-migration:migrate',
    );
    expect(projectConfig.targets.migrate.options.migrationsDir).toEqual(
      'src/migrations',
    );

    expect(projectConfig.targets['migrate-rollback']).toBeDefined();
    expect(projectConfig.targets['migrate-rollback'].executor).toEqual(
      '@nxlv/data-migration:rollback',
    );
    expect(
      projectConfig.targets['migrate-rollback'].options.migrationsDir,
    ).toEqual('src/migrations');

    expect(
      appTree.read(
        'libs/test/src/migrations/namespace/202301011-migration-name.ts',
        'utf-8',
      ),
    ).toMatchSnapshot();

    globSync
      .mockReturnValueOnce(['202301011-migration-name.ts'])
      .mockReturnValueOnce([]);

    await generator(appTree, options);

    expect(
      appTree.read(
        'libs/test/src/migrations/namespace/202301012-migration-name.ts',
        'utf-8',
      ),
    ).toMatchSnapshot();
  });

  it('should run successfully with custom migrations path', async () => {
    await generator(appTree, {
      ...options,
      migrationsDir: 'src/custom/migrations',
    });

    const projectConfig = readProjectConfiguration(appTree, 'test');
    expect(projectConfig.targets.migrate.options.migrationsDir).toEqual(
      'src/custom/migrations',
    );

    expect(
      appTree.read(
        'libs/test/src/custom/migrations/namespace/202301011-migration-name.ts',
        'utf-8',
      ),
    ).toMatchSnapshot();
  });

  it('should run successfully with after deploy lifecycle', async () => {
    await generator(appTree, {
      ...options,
      lifecycleHook: LifecycleHook.AFTER_DEPLOY,
    });

    expect(
      appTree.read(
        'libs/test/src/migrations/namespace/post-deploy/202301011-migration-name.ts',
        'utf-8',
      ),
    ).toMatchSnapshot();
  });

  it('should run successfully with after deploy lifecycle, dynamodb provider and stream', async () => {
    await generator(appTree, {
      ...options,
      migrationProvider: 'dynamodb',
      addStream: true,
      lifecycleHook: LifecycleHook.AFTER_DEPLOY,
    });

    expect(
      appTree.read(
        'libs/test/src/migrations/namespace/post-deploy/202301011-migration-name.ts',
        'utf-8',
      ),
    ).toMatchSnapshot();
    expect(
      appTree.read(
        'libs/test/src/migrations/namespace/post-deploy/202301011-migration-name.stream.ts',
        'utf-8',
      ),
    ).toMatchSnapshot();
  });

  it('should run successfully with after deploy lifecycle and parent version', async () => {
    await generator(appTree, {
      ...options,
      lifecycleHook: LifecycleHook.AFTER_DEPLOY,
      parentVersion: 202304031,
    });

    expect(
      appTree.read(
        'libs/test/src/migrations/namespace/post-deploy/202301011-migration-name.ts',
        'utf-8',
      ),
    ).toMatchSnapshot();
  });

  it('should run successfully with dynamodb provider', async () => {
    await generator(appTree, {
      ...options,
      migrationProvider: 'dynamodb',
    });

    expect(
      appTree.read(
        'libs/test/src/migrations/namespace/202301011-migration-name.ts',
        'utf-8',
      ),
    ).toMatchSnapshot();
  });

  it('should run successfully with dynamodb provider and stream', async () => {
    await generator(appTree, {
      ...options,
      migrationProvider: 'dynamodb',
      addStream: true,
    });

    expect(
      appTree.read(
        'libs/test/src/migrations/namespace/202301011-migration-name.ts',
        'utf-8',
      ),
    ).toMatchSnapshot();
    expect(
      appTree.read(
        'libs/test/src/migrations/namespace/202301011-migration-name.stream.ts',
        'utf-8',
      ),
    ).toMatchSnapshot();
  });

  it('should not update the project when the migration already exists', async () => {
    const projectConfig = readProjectConfiguration(appTree, 'test');
    projectConfig.targets.migrate = {
      executor: '@nxlv/data-migration:migrate',
      options: {
        migrationsDir: 'src/custom/migrations',
      },
    };
    projectConfig.targets['migrate-rollback'] = {
      executor: '@nxlv/data-migration:rollback',
      options: {
        migrationsDir: 'src/custom/migrations',
      },
    };

    updateProjectConfiguration(appTree, 'test', projectConfig);

    await generator(appTree, options);

    expect(
      appTree.read(
        'libs/test/src/custom/migrations/namespace/202301011-migration-name.ts',
        'utf-8',
      ),
    ).toMatchSnapshot();

    globSync
      .mockReturnValueOnce(['202301011-migration-name.ts'])
      .mockReturnValueOnce([]);

    await generator(appTree, options);

    expect(
      appTree.read(
        'libs/test/src/custom/migrations/namespace/202301012-migration-name.ts',
        'utf-8',
      ),
    ).toMatchSnapshot();
  });

  it('should run successfully with baseline flag', async () => {
    await generator(appTree, {
      ...options,
      baseline: true,
    });

    expect(
      appTree.read(
        'libs/test/src/migrations/namespace/202301011-migration-name.ts',
        'utf-8',
      ),
    ).toMatchSnapshot();
  });
});
