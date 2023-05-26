import { LifecycleHook } from '../../migrator';

export interface MigrationGeneratorSchema {
  project: string;
  name: string;
  namespace: string;
  description?: string;
  migrationsDir: string;
  migrationProvider: 'standard' | 'dynamodb';
  lifecycleHook: LifecycleHook;
  parentVersion?: number;
  addStream: boolean;
  baseline: boolean;
}
