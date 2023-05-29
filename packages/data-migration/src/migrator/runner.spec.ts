const promptsMock = jest.fn();

jest.mock('prompts', () => ({
  __esModule: true,
  default: promptsMock,
}));

// eslint-disable-next-line @nrwl/nx/enforce-module-boundaries
import { modelMock } from '@nxlv/testing/dynamoose-mock';
import { CLILogger } from './logger';
import { MigratorRunner } from './runner';
import path from 'path';
import { LifecycleHook } from './types';
import { EcsRemoteRunner } from './remote/ecs';

describe('MigratorRunner', () => {
  const logger = new CLILogger('info');

  beforeEach(() => {
    jest.clearAllMocks();

    jest
      .useFakeTimers()
      .setSystemTime(new Date('2023-01-01 12:00:00').getTime());
  });

  it('should be defined', () => {
    const migratorRunner = new MigratorRunner(
      process.cwd(),
      path.join(__dirname, '__mocks__'),
      logger,
      LifecycleHook.BEFORE_DEPLOY
    );

    expect(migratorRunner).toBeDefined();
  });

  describe('init', () => {
    it('should init all migrations successfully', async () => {
      const migratorRunner = new MigratorRunner(
        process.cwd(),
        path.join(__dirname, '__mocks__', 'success'),
        logger,
        LifecycleHook.BEFORE_DEPLOY
      );

      await migratorRunner.init();

      expect(migratorRunner.migrations.length).toEqual(1);
    });

    it('should not init migrations that are not in the lifecycle hook', async () => {
      const migratorRunner = new MigratorRunner(
        process.cwd(),
        path.join(__dirname, '__mocks__', 'success'),
        logger,
        LifecycleHook.AFTER_DEPLOY
      );

      await migratorRunner.run();

      expect(migratorRunner.migrations.length).toEqual(0);
    });

    it('should not init migrations when a migration condition is not met', async () => {
      const migratorRunner = new MigratorRunner(
        process.cwd(),
        path.join(__dirname, '__mocks__', 'condition-false'),
        logger,
        LifecycleHook.BEFORE_DEPLOY
      );

      await migratorRunner.run();

      expect(migratorRunner.migrations.length).toEqual(0);
    });

    it('should init migrations when a migration condition is met', async () => {
      const migratorRunner = new MigratorRunner(
        process.cwd(),
        path.join(__dirname, '__mocks__', 'condition-true'),
        logger,
        LifecycleHook.BEFORE_DEPLOY
      );

      await migratorRunner.init();

      expect(migratorRunner.migrations.length).toEqual(2);
    });

    it('should throw an exception when the namespace is missing', () => {
      const migratorRunner = new MigratorRunner(
        process.cwd(),
        path.join(__dirname, '__mocks__', 'missing-namespace'),
        logger,
        LifecycleHook.BEFORE_DEPLOY
      );

      expect(migratorRunner.init()).rejects.toThrowError(
        'missing or empty namespace for migration'
      );
    });

    it('should throw an exception when the version is missing', () => {
      const migratorRunner = new MigratorRunner(
        process.cwd(),
        path.join(__dirname, '__mocks__', 'missing-version'),
        logger,
        LifecycleHook.BEFORE_DEPLOY
      );

      expect(migratorRunner.init()).rejects.toThrowError(
        'version must be more than 0 for migration'
      );
    });

    it('should throw an exception when the name is missing', () => {
      const migratorRunner = new MigratorRunner(
        process.cwd(),
        path.join(__dirname, '__mocks__', 'missing-name'),
        logger,
        LifecycleHook.BEFORE_DEPLOY
      );

      expect(migratorRunner.init()).rejects.toThrowError(
        'missing or empty name for migration'
      );
    });

    it('should throw an exception when the migrations are duplicated', () => {
      const migratorRunner = new MigratorRunner(
        process.cwd(),
        path.join(__dirname, '__mocks__', 'duplicates'),
        logger,
        LifecycleHook.BEFORE_DEPLOY
      );

      expect(migratorRunner.init()).rejects.toThrowError(
        'Duplicate migration found'
      );
    });

    it('should drop all versions before baseline', async () => {
      modelMock.batchGet.mockResolvedValueOnce([]);

      const migratorRunner = new MigratorRunner(
        process.cwd(),
        path.join(__dirname, '__mocks__', 'baseline'),
        logger,
        LifecycleHook.BEFORE_DEPLOY
      );

      await migratorRunner.init();

      expect(migratorRunner.migrations.length).toEqual(4);

      const pending = await migratorRunner.getPendingMigrations();

      expect(pending.length).toEqual(2);
      expect(pending[0].version).toBe(20230103);
      expect(pending[1].version).toBe(20230104);
    });

    it('should drop all versions before baseline and not drop any version from the second namespace', async () => {
      modelMock.batchGet.mockResolvedValueOnce([]);

      const migratorRunner = new MigratorRunner(
        process.cwd(),
        path.join(__dirname, '__mocks__', 'baseline-multiple-namespace'),
        logger,
        LifecycleHook.BEFORE_DEPLOY
      );

      await migratorRunner.init();

      expect(migratorRunner.migrations.length).toEqual(6);

      const pending = await migratorRunner.getPendingMigrations();

      expect(pending.length).toEqual(4);

      expect(pending[0].namespace).toBe('test1');
      expect(pending[0].version).toBe(20230101);

      expect(pending[1].namespace).toBe('test1');
      expect(pending[1].version).toBe(20230102);

      expect(pending[2].namespace).toBe('test');
      expect(pending[2].version).toBe(20230103);

      expect(pending[3].namespace).toBe('test');
      expect(pending[3].version).toBe(20230104);
    });

    it('should not drop any version when the environment already have migrations applied to the same namespace', async () => {
      modelMock.batchGet.mockResolvedValueOnce([
        {
          namespace: 'test',
          version: 20230101,
          name: 'test1',
          status: 'SUCCESS',
        },
      ]);

      const migratorRunner = new MigratorRunner(
        process.cwd(),
        path.join(__dirname, '__mocks__', 'baseline'),
        logger,
        LifecycleHook.BEFORE_DEPLOY
      );

      await migratorRunner.init();

      expect(migratorRunner.migrations.length).toEqual(4);

      const pending = await migratorRunner.getPendingMigrations();

      expect(pending.length).toEqual(2);
      expect(pending[0].version).toBe(20230102);
      expect(pending[1].version).toBe(20230104);
    });

    it('should init all migrations with multiple namespaces successfully', async () => {
      modelMock.batchGet.mockResolvedValueOnce([]);

      const migratorRunner = new MigratorRunner(
        process.cwd(),
        path.join(__dirname, '__mocks__', 'success-multiple-namespace'),
        logger,
        LifecycleHook.BEFORE_DEPLOY
      );

      await migratorRunner.init();

      expect(migratorRunner.migrations.length).toEqual(2);

      const pending = await migratorRunner.getPendingMigrations();
      expect(pending.length).toEqual(2);
    });
  });

  describe('run', () => {
    it('should not any migration when all migrations are already applied', async () => {
      modelMock.batchGet.mockResolvedValueOnce([
        {
          namespace: 'test',
          version: 20230101,
          name: 'test1',
          status: 'SUCCESS',
        },
      ]);

      const migratorRunner = new MigratorRunner(
        process.cwd(),
        path.join(__dirname, '__mocks__', 'success'),
        logger,
        LifecycleHook.BEFORE_DEPLOY
      );

      await migratorRunner.run();

      expect(migratorRunner.migrations.length).toEqual(1);
      expect(modelMock.batchGet).toHaveBeenCalledWith([
        { namespace: 'test', version: 20230101 },
      ]);
      expect(modelMock.create).not.toHaveBeenCalled();
      expect(modelMock.update).not.toHaveBeenCalled();
    });

    it('should run all migrations successfully', async () => {
      modelMock.batchGet.mockResolvedValueOnce([]);

      const migratorRunner = new MigratorRunner(
        process.cwd(),
        path.join(__dirname, '__mocks__', 'success'),
        logger,
        LifecycleHook.BEFORE_DEPLOY
      );

      await migratorRunner.run();

      expect(migratorRunner.migrations.length).toEqual(1);
      expect(modelMock.batchGet).toHaveBeenCalledWith([
        { namespace: 'test', version: 20230101 },
      ]);
      expect(modelMock.create).toHaveBeenCalledWith(
        {
          description: undefined,
          migrationPath: path.join(
            path.relative(process.cwd(), __dirname),
            '__mocks__/success/20230101-test1.ts'
          ),
          name: 'test1',
          namespace: 'test',
          startDate: new Date(),
          status: 'RUNNING',
          version: 20230101,
        },
        { overwrite: true }
      );
      expect(modelMock.update).toHaveBeenCalledWith(
        { namespace: 'test', version: 20230101 },
        { endDate: new Date(), status: 'SUCCESS' }
      );
    });

    it('should throw an exception when the migration failures', async () => {
      modelMock.batchGet.mockResolvedValueOnce([]);

      const migratorRunner = new MigratorRunner(
        process.cwd(),
        path.join(__dirname, '__mocks__', 'failure'),
        logger,
        LifecycleHook.BEFORE_DEPLOY
      );

      await expect(migratorRunner.run()).rejects.toThrowError(
        'Error running migration'
      );

      expect(modelMock.batchGet).toHaveBeenCalledWith([
        { namespace: 'test', version: 20230101 },
      ]);
      expect(modelMock.create).toHaveBeenCalledWith(
        {
          description: undefined,
          migrationPath: path.join(
            path.relative(process.cwd(), __dirname),
            '__mocks__/failure/20230101-test1.ts'
          ),
          name: 'test1',
          namespace: 'test',
          startDate: new Date(),
          status: 'RUNNING',
          version: 20230101,
        },
        { overwrite: true }
      );
      expect(modelMock.update).toHaveBeenCalledWith(
        { namespace: 'test', version: 20230101 },
        { endDate: new Date(), status: 'ERROR', errorMessage: 'up' }
      );
    });

    it('should throw an exception when the remote config has an invalid type', async () => {
      modelMock.batchGet.mockResolvedValueOnce([]);

      const migratorRunner = new MigratorRunner(
        process.cwd(),
        path.join(__dirname, '__mocks__', 'invalid-remote-type'),
        logger,
        LifecycleHook.BEFORE_DEPLOY
      );

      await expect(migratorRunner.run()).rejects.toThrowError(
        'Unsupported remote type invalid'
      );
    });

    it('should delegate the execution to the remote runner when the remote config is present', async () => {
      modelMock.batchGet.mockResolvedValueOnce([]);

      const migratorRunner = new MigratorRunner(
        process.cwd(),
        path.join(__dirname, '__mocks__', 'ecs-remote'),
        logger,
        LifecycleHook.BEFORE_DEPLOY
      );

      const runMock = jest
        .spyOn(EcsRemoteRunner.prototype, 'run')
        .mockResolvedValueOnce(null);

      await migratorRunner.run();

      expect(runMock).toHaveBeenCalled();
    });
  });

  describe('rollback', () => {
    it('should throw an exception when the from namespace is different from the to namespace', async () => {
      const migratorRunner = new MigratorRunner(
        process.cwd(),
        path.join(__dirname, '__mocks__', 'success'),
        logger,
        LifecycleHook.BEFORE_DEPLOY
      );

      await expect(
        migratorRunner.rollback('test', 20230101, 'test2', 20230101)
      ).rejects.toThrowError(
        'Rollback to different namespace is not supported'
      );
    });

    it('should not rollback then when there is not equal or greater the version than what was specified', async () => {
      const infoMock = jest.spyOn(console, 'info');
      const migratorRunner = new MigratorRunner(
        process.cwd(),
        path.join(__dirname, '__mocks__', 'success'),
        logger,
        LifecycleHook.BEFORE_DEPLOY
      );

      await migratorRunner.rollback('test', 20230102);
      expect(infoMock).toHaveBeenLastCalledWith(
        expect.stringContaining('No migrations to rollback')
      );
    });

    it('should not rollback when the version specified is not applied yet', async () => {
      const infoMock = jest.spyOn(console, 'info');

      modelMock.batchGet.mockResolvedValueOnce([]);

      const migratorRunner = new MigratorRunner(
        process.cwd(),
        path.join(__dirname, '__mocks__', 'success'),
        logger,
        LifecycleHook.BEFORE_DEPLOY
      );

      await migratorRunner.rollback('test', 20230101);
      expect(infoMock).toHaveBeenLastCalledWith(
        expect.stringContaining('No migrations to rollback')
      );
    });

    it('should not rollback when the version is already rolled back', async () => {
      const infoMock = jest.spyOn(console, 'info');

      modelMock.batchGet.mockResolvedValueOnce([
        {
          namespace: 'test',
          version: 20230101,
          name: 'test1',
          status: 'ROLLBACK_SUCCESS',
        },
      ]);

      const migratorRunner = new MigratorRunner(
        process.cwd(),
        path.join(__dirname, '__mocks__', 'success'),
        logger,
        LifecycleHook.BEFORE_DEPLOY
      );

      await migratorRunner.rollback('test', 20230101);
      expect(infoMock).toHaveBeenLastCalledWith(
        expect.stringContaining('No migrations to rollback')
      );
    });

    it('should not rollback when the user reject the confirm prompt', async () => {
      const infoMock = jest.spyOn(console, 'info');
      promptsMock.mockResolvedValueOnce({ value: false });

      modelMock.batchGet.mockResolvedValueOnce([
        {
          namespace: 'test',
          version: 20230101,
          name: 'test1',
          status: 'SUCCESS',
        },
      ]);

      const migratorRunner = new MigratorRunner(
        process.cwd(),
        path.join(__dirname, '__mocks__', 'success'),
        logger,
        LifecycleHook.BEFORE_DEPLOY
      );

      await migratorRunner.rollback('test', 20230101);
      expect(infoMock).toHaveBeenLastCalledWith(
        expect.stringContaining('Rollback migrations cancelled')
      );
      expect(promptsMock).toHaveBeenCalledWith({
        initial: false,
        message: 'Are you sure you want to rollback migrations?',
        name: 'value',
        type: 'confirm',
      });
    });

    it('should rollback when the user accepts the confirm prompt', async () => {
      promptsMock.mockResolvedValueOnce({ value: true });

      modelMock.batchGet.mockResolvedValueOnce([
        {
          namespace: 'test',
          version: 20230101,
          name: 'test1',
          status: 'SUCCESS',
        },
      ]);

      const migratorRunner = new MigratorRunner(
        process.cwd(),
        path.join(__dirname, '__mocks__', 'success'),
        logger,
        LifecycleHook.BEFORE_DEPLOY
      );

      await migratorRunner.rollback('test', 20230101);

      expect(promptsMock).toHaveBeenCalledWith({
        initial: false,
        message: 'Are you sure you want to rollback migrations?',
        name: 'value',
        type: 'confirm',
      });

      expect(modelMock.update).toHaveBeenCalledTimes(2);
      expect(modelMock.update).toHaveBeenNthCalledWith(
        1,
        {
          namespace: 'test',
          version: 20230101,
        },
        { rollbackStartDate: new Date(), status: 'ROLLBACK_RUNNING' }
      );
      expect(modelMock.update).toHaveBeenNthCalledWith(
        2,
        { namespace: 'test', version: 20230101 },
        { rollbackEndDate: new Date(), status: 'ROLLBACK_SUCCESS' }
      );
    });

    it('should throw an exception when the rollback fails', async () => {
      modelMock.batchGet.mockResolvedValueOnce([
        {
          namespace: 'test',
          version: 20230101,
          name: 'test1',
          status: 'SUCCESS',
        },
      ]);

      const migratorRunner = new MigratorRunner(
        process.cwd(),
        path.join(__dirname, '__mocks__', 'rollback-failure'),
        logger,
        LifecycleHook.BEFORE_DEPLOY
      );

      await expect(
        migratorRunner.rollback('test', 20230101, 'test', 20230101, true)
      ).rejects.toThrowError('down');

      expect(promptsMock).not.toHaveBeenCalled();
      expect(modelMock.update).toHaveBeenCalledTimes(2);
      expect(modelMock.update).toHaveBeenNthCalledWith(
        1,
        {
          namespace: 'test',
          version: 20230101,
        },
        { rollbackStartDate: new Date(), status: 'ROLLBACK_RUNNING' }
      );
      expect(modelMock.update).toHaveBeenNthCalledWith(
        2,
        { namespace: 'test', version: 20230101 },
        {
          rollbackEndDate: new Date(),
          status: 'ROLLBACK_ERROR',
          errorMessage: 'down',
        }
      );
    });
  });
});
