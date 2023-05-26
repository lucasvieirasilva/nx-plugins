import { MigrationStateModel } from '../model/state.model';
import { CLILogger } from '../logger';
import { MigrationBase } from '../migration';
import { MigrationStatus } from '../types';
import { ManagedMigrationError } from '../error/migrator-error';

const logger = new CLILogger(process.env.LOG_LEVEL);

const wrapper = async () => {
  const migration = await getMigration();

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
    logger.info(
      `Migration ${migration.namespace}:${migration.name}:${migration.version} successfully completed`
    );
  } catch (err) {
    logger.debug(JSON.stringify(err));
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

    logger.info('Rolling back migration');
    await migration.down();
    logger.info('Rollback complete');

    throw new ManagedMigrationError(`Error running migration: ${err.message}`);
  }
};

const rollbackWrapper = async () => {
  const migration = await getMigration();

  try {
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
    logger.debug(JSON.stringify(err));
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
      `Failed to rollback migration ${migration.namespace}:${migration.name}:${migration.version}: ${err.message}`
    );
  }
};

async function getMigration() {
  console.log(`Loading migration from ${process.env.MIGRATION_FILE_NAME}`);
  const path = require.resolve(process.env.MIGRATION_FILE_NAME);
  console.log(`Resolved migration path to ${path}`);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const migrationType = require(path);
  const migration = new migrationType.default() as MigrationBase;
  migration.logger = logger;
  return migration;
}

console.log(`Running migration in ${process.env.OPERATION} mode`);
const promise =
  process.env.OPERATION === 'rollback' ? rollbackWrapper() : wrapper();

promise
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(9);
  });
