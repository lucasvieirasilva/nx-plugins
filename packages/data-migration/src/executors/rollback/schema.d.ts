import { LoggerLevels, LifecycleHook } from '../../migrator/types';

export interface RollbackExecutorSchema {
  env: string;
  cwd: string;
  migrationsDir: string;
  logLevel: LoggerLevels;
  lifecycleHook: LifecycleHook;
  from: string;
  to?: string;
  yes: boolean;
  migrationTableName?: string;
}
