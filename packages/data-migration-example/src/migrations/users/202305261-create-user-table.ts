import {
  Migration,
  DynamoDBMigrationBase,
  LifecycleHook,
} from '@nxlv/data-migration';

@Migration({
  namespace: 'users',
  version: 202305261,
  name: 'create-user-table',
  description: 'Create User Table',
  lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
})
export default class extends DynamoDBMigrationBase {
  async up(): Promise<void> {
    await this.createTable({
      TableName: 'example-users',
      AttributeDefinitions: [
        {
          AttributeName: 'id',
          AttributeType: 'S',
        },
      ],
      KeySchema: [
        {
          AttributeName: 'id',
          KeyType: 'HASH',
        },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    });
  }

  async down(): Promise<void> {
    await this.deleteTable('example-users');
  }
}
