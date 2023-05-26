// eslint-disable-next-line @nrwl/nx/enforce-module-boundaries
import '@nxlv/testing/dynamoose-mock';
import { RollbackExecutorSchema } from './schema';
import executor from './executor';
import { ExecutorContext } from '@nrwl/devkit';
import { MigratorRunner } from '../../migrator/runner';
import { LifecycleHook } from '../../migrator';

const options: RollbackExecutorSchema = {
  migrationsDir: 'src/migrations',
  cwd: 'libs/test',
  env: 'test',
  logLevel: 'info',
  lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
  from: 'namespace:1',
  to: 'namespace:2',
  yes: false,
};

describe('Rollback Executor', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should run the rollback only with from', async () => {
    const rollbackMock = jest
      .spyOn(MigratorRunner.prototype, 'rollback')
      .mockResolvedValue();

    const output = await executor(
      {
        ...options,
        to: undefined,
      },
      {
        cwd: '/root',
      } as ExecutorContext
    );
    expect(output.success).toBe(true);
    expect(rollbackMock).toHaveBeenCalledWith(
      'namespace',
      1,
      undefined,
      undefined,
      false
    );
    expect(process.env.NODE_ENV).toBe('test');
  });

  it('should run the rollback with from and to', async () => {
    const rollbackMock = jest
      .spyOn(MigratorRunner.prototype, 'rollback')
      .mockResolvedValue();

    const output = await executor(options, {
      cwd: '/root',
    } as ExecutorContext);
    expect(output.success).toBe(true);
    expect(rollbackMock).toHaveBeenCalledWith(
      'namespace',
      1,
      'namespace',
      2,
      false
    );
    expect(process.env.NODE_ENV).toBe('test');
  });

  it('should fail the rollback', async () => {
    const rollbackMock = jest
      .spyOn(MigratorRunner.prototype, 'rollback')
      .mockRejectedValue(new Error('test'));

    const output = await executor(options, {
      cwd: '/root',
    } as ExecutorContext);
    expect(output.success).toBe(false);
    expect(rollbackMock).toHaveBeenCalledWith(
      'namespace',
      1,
      'namespace',
      2,
      false
    );
    expect(process.env.NODE_ENV).toBe('test');
  });

  it('should run the rollback and set the migration table name', async () => {
    const rollbackMock = jest
      .spyOn(MigratorRunner.prototype, 'rollback')
      .mockResolvedValue();

    const output = await executor(
      {
        ...options,
        migrationTableName: 'some-table-name',
        to: undefined,
      },
      {
        cwd: '/root',
      } as ExecutorContext
    );
    expect(output.success).toBe(true);
    expect(rollbackMock).toHaveBeenCalledWith(
      'namespace',
      1,
      undefined,
      undefined,
      false
    );
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.MIGRATION_TABLE_NAME).toBe('some-table-name');
  });
});
