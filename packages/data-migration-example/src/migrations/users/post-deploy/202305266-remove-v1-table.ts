import {
  Migration,
  DynamoDBMigrationBase,
  LifecycleHook,
} from '@nxlv/data-migration';

@Migration({
  namespace: 'users',
  version: 202305266,
  name: 'remove-v1-table',
  description: 'Remove v1 Table',
  lifecycleHook: LifecycleHook.AFTER_DEPLOY,
  parentVersion: 202305264,
})
export default class extends DynamoDBMigrationBase {
  async up(): Promise<void> {
    await this.removeStream(
      'example-users',
      'migrate-v1-to-v2',
      this.parentVersion as number
    );
  }

  async down(): Promise<void> {
    this.logger.warn('No down migration for remove-v1-table');
  }
}
