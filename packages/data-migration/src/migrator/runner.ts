import { MigrationStateModel } from './model/state.model';
import esbuild from 'esbuild';
import path from 'path';
import { LifecycleHook, MigrationBase, MigrationStatus } from './types';
import { ManagedMigrationError } from './error/migrator-error';
import _ from 'lodash';
import { CLILogger } from './logger';
import chalk from 'chalk';
import { globSync } from 'glob';
import prompts from 'prompts';
import { EcsRemoteRunner } from './remote/ecs';
import fs from 'fs';

export class MigratorRunner {
  migrations: MigrationBase[] = [];

  constructor(
    private readonly cwd: string,
    private readonly migrationsPath: string,
    private readonly logger: CLILogger,
    private readonly lifecycleHook: LifecycleHook
  ) {}

  private async loadMigrations() {
    const migrationFiles = globSync(
      path.join(path.relative(this.cwd, this.migrationsPath), '**/*.ts'),
      {
        cwd: this.cwd,
        absolute: true,
        ignore: ['**/*.transform.ts', '**/*.model.ts', '**/*.schema.ts'],
      }
    );

    const pkg = JSON.parse(
      fs.readFileSync(path.join(this.cwd, 'package.json')).toString('utf-8')
    );
    const external = [
      '@nxlv/data-migration',
      ...Object.keys(pkg.dependencies),
      ...Object.keys(pkg.devDependencies),
    ];

    for (const migrationFile of migrationFiles) {
      const migrationFileRelative = path.relative(this.cwd, migrationFile);
      const distFile = path.join(
        'dist',
        migrationFileRelative.replace('.ts', '.js')
      );

      this.logger.debug(
        `Compiling ${migrationFileRelative} migration using esbuild`
      );
      const buildStart = Date.now();
      await esbuild.build({
        format: 'cjs',
        bundle: true,
        minify: false,
        sourcemap: false,
        target: ['node18'],
        entryPoints: [migrationFile],
        outfile: distFile,
        platform: 'node',
        external,
      });
      this.logger.debug(
        `Migration ${migrationFileRelative} compiled in ${
          Date.now() - buildStart
        }ms`
      );

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const migrationType = require(require.resolve(
        path.join(this.cwd, distFile)
      ));
      const migration = new migrationType.default() as MigrationBase;
      migration.logger = this.logger;
      migration.path = migrationFileRelative;
      migration.distPath = distFile;

      if (_.isNil(migration.namespace) || _.isEmpty(migration.namespace)) {
        throw new ManagedMigrationError(
          `missing or empty namespace for migration: ${chalk.bold(
            path.relative(this.cwd, migrationFile)
          )}`
        );
      }

      if (_.isNil(migration.version) || migration.version <= 0) {
        throw new ManagedMigrationError(
          `version must be more than 0 for migration: ${chalk.bold(
            path.relative(this.cwd, migrationFile)
          )}`
        );
      }

      if (_.isNil(migration.name) || _.isEmpty(migration.name)) {
        throw new ManagedMigrationError(
          `missing or empty name for migration: ${chalk.bold(
            path.relative(this.cwd, migrationFile)
          )}`
        );
      }

      if (
        this.migrations.some(
          (m) =>
            m.namespace === migration.namespace &&
            m.version === migration.version
        )
      ) {
        throw new ManagedMigrationError(
          `Duplicate migration found: ${chalk.bold(
            `${migration.namespace}:${migration.name}:${migration.version}`
          )}`
        );
      }

      if ((await migration.condition()) === false) {
        this.logger.info(
          `Skipping migration ${chalk.bold(
            `${migration.namespace}:${migration.name}:${migration.version}`
          )} as condition is not met`
        );
        continue;
      }

      if (migration.lifecycleHook === this.lifecycleHook) {
        this.migrations.push(migration);
      }
    }

    this.migrations = _.sortBy(this.migrations, (m) => m.version);
  }

  public async getPendingMigrations() {
    if (this.migrations.length === 0) {
      return [];
    }

    const result = await MigrationStateModel.batchGet(
      this.migrations.map(({ namespace, version }) => ({
        namespace,
        version,
      }))
    );

    const pendingMigrations = this.migrations.filter(
      (migration) =>
        !result.find(
          (state) =>
            state.namespace === migration.namespace &&
            state.version === migration.version &&
            state.status === MigrationStatus.SUCCESS
        )
    );

    const baselinesGroupByNamespace = _.groupBy(
      _.orderBy(pendingMigrations, ['version'], ['desc']).filter(
        (m) => m.baseline === true
      ),
      (m) => m.namespace
    );

    for (const [namespace, migrations] of Object.entries(
      baselinesGroupByNamespace
    )) {
      const lastBaseline = migrations[0];

      if (result.filter((m) => m.namespace === namespace).length === 0) {
        const dropVersions = pendingMigrations.filter(
          (m) => m.namespace === namespace && m.version < lastBaseline.version
        );

        for (const dropVersion of dropVersions) {
          this.logger.info(
            `Dropping migration ${chalk.bold(
              `${dropVersion.namespace}:${dropVersion.name}:${dropVersion.version}`
            )} as it is not part of the baseline`
          );
          pendingMigrations.splice(pendingMigrations.indexOf(dropVersion), 1);
        }
      } else {
        console.log('migrations', migrations);
        for (const migration of migrations) {
          this.logger.debug(
            `Dropping migration ${chalk.bold(
              `${migration.namespace}:${migration.name}:${migration.version}`
            )} as this environment already has migrations from this namespace`
          );
          pendingMigrations.splice(pendingMigrations.indexOf(migration), 1);
        }
      }
    }

    return pendingMigrations;
  }

  async init() {
    this.logger.info(
      `Resolving migrations from ${chalk.bold(this.migrationsPath)}`
    );
    await this.loadMigrations();
    this.logger.info(`Found ${chalk.bold(this.migrations.length)} migrations`);
  }

  async rollback(
    fromNamespace: string,
    fromVersion: number,
    toNamespace?: string,
    toVersion?: number,
    confirm = false
  ) {
    await this.init();
    this.logger.info(
      `Rollback migrations for namespace ${chalk.bold(
        fromNamespace
      )} from version ${chalk.bold(fromVersion)}` +
        (toNamespace ? ` to namespace ${chalk.bold(toNamespace)}` : '') +
        (toVersion ? ` to version ${chalk.bold(toVersion)}` : '')
    );

    if (toNamespace && toNamespace !== fromNamespace) {
      throw new ManagedMigrationError(
        `Rollback to different namespace is not supported`
      );
    }

    const migrations = this.migrations.filter(
      (m) =>
        m.lifecycleHook === this.lifecycleHook &&
        m.namespace === fromNamespace &&
        m.version >= fromVersion &&
        m.version <= (toVersion ?? m.version)
    );

    const stateMigrations = await MigrationStateModel.batchGet(
      migrations.map(({ namespace, version }) => ({ namespace, version }))
    );

    const notImplementedMigrations = migrations.filter((m) =>
      _.isNil(
        stateMigrations.find(
          (s) => s.namespace === m.namespace && s.version === s.version
        )
      )
    );
    const alreadyRolledBackMigrations = migrations.filter(
      (m) =>
        !_.isNil(
          stateMigrations.find(
            (s) =>
              s.namespace === m.namespace &&
              s.version === m.version &&
              s.status === MigrationStatus.ROLLBACK_SUCCESS
          )
        )
    );

    const pendingMigrations = migrations.filter(
      (m) =>
        !notImplementedMigrations.includes(m) &&
        !alreadyRolledBackMigrations.includes(m)
    );

    if (notImplementedMigrations.length > 0) {
      this.logger.warn(
        `Cannot rollback the following migrations because they are not applied: \n\n   - ${notImplementedMigrations
          .map((m) => chalk.bold(`${m.namespace}:${m.name}:${m.version}`))
          .join('\n   - ')}\n`
      );
    }

    if (alreadyRolledBackMigrations.length > 0) {
      this.logger.warn(
        `Cannot rollback the following migrations because they are already rolled back: \n\n   - ${alreadyRolledBackMigrations
          .map((m) => chalk.bold(`${m.namespace}:${m.name}:${m.version}`))
          .join('\n   - ')}\n`
      );
    }

    if (pendingMigrations.length === 0) {
      this.logger.info(`No migrations to rollback`);
      return;
    }

    this.logger.info(
      `Rollback migrations: \n\n   - ${pendingMigrations
        .map((m) => chalk.bold(`${m.namespace}:${m.name}:${m.version}`))
        .join('\n   - ')}\n`
    );

    if (!confirm) {
      const resp = await prompts({
        type: 'confirm',
        name: 'value',
        message: `Are you sure you want to rollback migrations?`,
        initial: false,
      });

      if (!resp.value) {
        this.logger.info(`Rollback migrations cancelled`);
        return;
      }
    }

    for (const migration of pendingMigrations.reverse()) {
      try {
        this.logger.info(
          `Rollback migration ${chalk.bold(
            `${migration.namespace}:${migration.name}:${migration.version}`
          )}`
        );

        await MigrationStateModel.update(
          {
            version: migration.version,
            namespace: migration.namespace,
          },
          {
            status: MigrationStatus.ROLLBACK_RUNNING,
            rollbackStartDate: new Date(),
          }
        );

        await migration.down();

        await MigrationStateModel.update(
          {
            version: migration.version,
            namespace: migration.namespace,
          },
          {
            status: MigrationStatus.ROLLBACK_SUCCESS,
            rollbackEndDate: new Date(),
          }
        );
      } catch (err) {
        this.logger.debug(JSON.stringify(err));
        await MigrationStateModel.update(
          {
            version: migration.version,
            namespace: migration.namespace,
          },
          {
            status: MigrationStatus.ROLLBACK_ERROR,
            rollbackEndDate: new Date(),
            errorMessage: err.message,
          }
        );
        throw new ManagedMigrationError(
          `Failed to rollback migration ${chalk.bold(
            `${migration.namespace}:${migration.name}:${migration.version}`
          )}: ${err.message}`
        );
      }
    }
  }

  async run() {
    await this.init();
    const pendingMigrations = await this.getPendingMigrations();

    if (pendingMigrations.length === 0) {
      this.logger.warn(`No pending migrations found.`);
      return;
    }

    this.logger.info(
      `Running ${chalk.bold(pendingMigrations.length)} pending migrations`
    );
    for (const migration of pendingMigrations) {
      this.logger.info(
        `Running migration ${chalk.bold(
          `${migration.namespace}:${migration.name}:${migration.version}`
        )}`
      );

      if (migration.remote) {
        switch (migration.remote.type) {
          case 'ecs': {
            await new EcsRemoteRunner(this.logger, migration).run();
            continue;
          }
          default: {
            throw new ManagedMigrationError(
              `Unsupported remote type ${migration.remote.type}`
            );
          }
        }
      }

      try {
        await MigrationStateModel.create(
          {
            version: migration.version,
            namespace: migration.namespace,
            description: migration.description,
            name: migration.name,
            status: MigrationStatus.RUNNING,
            startDate: new Date(),
            migrationPath: migration.path,
          },
          { overwrite: true }
        );

        await migration.up();

        await MigrationStateModel.update(
          {
            version: migration.version,
            namespace: migration.namespace,
          },
          {
            status: MigrationStatus.SUCCESS,
            endDate: new Date(),
          }
        );
        this.logger.info(
          `Migration ${chalk.bold(
            `${migration.namespace}:${migration.name}:${migration.version}`
          )} successfully completed`
        );
      } catch (err) {
        this.logger.debug(JSON.stringify(err));
        await MigrationStateModel.update(
          {
            version: migration.version,
            namespace: migration.namespace,
          },
          {
            status: MigrationStatus.ERROR,
            endDate: new Date(),
            errorMessage: err.message,
          }
        );

        this.logger.info('Rolling back migration');
        await migration.down();
        this.logger.info('Rollback complete');

        throw new ManagedMigrationError(
          `Error running migration: ${err.message}`
        );
      }
    }
  }
}
