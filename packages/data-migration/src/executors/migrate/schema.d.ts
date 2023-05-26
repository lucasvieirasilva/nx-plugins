import { LoggerLevels, LifecycleHook } from '../../migrator/types';

export interface MigrateExecutorSchema {
  env: string;
  cwd: string;
  migrationsDir: string;
  logLevel: LoggerLevels;
  lifecycleHook: LifecycleHook;
  migrationTableName?: string;
}
