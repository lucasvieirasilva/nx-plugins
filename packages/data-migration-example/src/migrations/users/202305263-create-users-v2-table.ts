import {
  Migration,
  DynamoDBMigrationBase,
  LifecycleHook,
} from '@nxlv/data-migration';

@Migration({
  namespace: 'users',
  version: 202305263,
  name: 'create-users-v2-table',
  description: 'Create Users V2 Table',
  lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
})
export default class extends DynamoDBMigrationBase {
  async up(): Promise<void> {
    await this.createTable({
      TableName: 'example-users-v2',
      AttributeDefinitions: [
        {
          AttributeName: 'userId',
          AttributeType: 'S',
        },
      ],
      KeySchema: [
        {
          AttributeName: 'userId',
          KeyType: 'HASH',
        },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    });
  }

  async down(): Promise<void> {
    await this.deleteTable('example-users-v2');
  }
}
