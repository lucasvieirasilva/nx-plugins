import '../../__mocks__/dynamoose.mock';
import { vi } from 'vitest';
import { MigrateExecutorSchema } from './schema';
import executor from './executor';
import { ExecutorContext } from '@nx/devkit';
import { MigratorRunner } from '../../migrator/runner';
import { LifecycleHook } from '../../migrator';

const options: MigrateExecutorSchema = {
  migrationsDir: 'src/migrations',
  cwd: 'libs/test',
  env: 'test',
  logLevel: 'info',
  lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
};

describe('Migrate Executor', () => {
  it('should run the migration', async () => {
    const runMock = vi
      .spyOn(MigratorRunner.prototype, 'run')
      .mockResolvedValue();

    const output = await executor(options, {
      cwd: '/root',
    } as ExecutorContext);
    expect(output.success).toBe(true);
    expect(runMock).toHaveBeenCalled();
    expect(process.env.NODE_ENV).toBe('test');
  });

  it('should fail the migration', async () => {
    const runMock = vi
      .spyOn(MigratorRunner.prototype, 'run')
      .mockRejectedValue(new Error('test'));

    const output = await executor(options, {
      cwd: '/root',
    } as ExecutorContext);
    expect(output.success).toBe(false);
    expect(runMock).toHaveBeenCalled();
    expect(process.env.NODE_ENV).toBe('test');
  });

  it('should run the migration and set the migration table name', async () => {
    const runMock = vi
      .spyOn(MigratorRunner.prototype, 'run')
      .mockResolvedValue();

    const output = await executor(
      { ...options, migrationTableName: 'some-table-name' },
      {
        cwd: '/root',
      } as ExecutorContext,
    );
    expect(output.success).toBe(true);
    expect(runMock).toHaveBeenCalled();
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.MIGRATION_TABLE_NAME).toBe('some-table-name');
  });
});
