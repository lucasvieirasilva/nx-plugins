import {
  Migration,
  DynamoDBMigrationBase,
  LifecycleHook,
} from '@nxlv/data-migration';
import { chunks } from '@nxlv/util';
import {
  BatchWriteCommand,
  ScanCommand,
  DynamoDBDocumentClient,
  ScanCommandOutput,
} from '@aws-sdk/lib-dynamodb';

@Migration({
  namespace: 'users',
  version: 202305264,
  name: 'migrate-v1-to-v2',
  description: 'Migrate data from v1 to v2',
  lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
})
export default class extends DynamoDBMigrationBase {
  docClient: DynamoDBDocumentClient;

  constructor() {
    super();
    this.docClient = DynamoDBDocumentClient.from(this.client);
  }

  async up(): Promise<void> {
    await this.enableStream('example-users');

    this.logger.info('Migrating users from v1 to v2');
    let count = 0;
    for await (const items of this.scanTable('example-users')) {
      for (const chunk of chunks(items, 25)) {
        await this.docClient.send(
          new BatchWriteCommand({
            RequestItems: {
              'example-users-v2': chunk.map((item) => ({
                PutRequest: {
                  Item: {
                    userId: item['id'],
                    name: item['name'],
                  },
                },
              })),
            },
          })
        );

        count += chunk.length;
      }
    }

    this.logger.info(`Migrated ${count} users`);
  }

  async down(): Promise<void> {
    await this.removeStream('example-users', this.name, this.version);

    for await (const items of this.scanTable('example-users-v2')) {
      for (const chunk of chunks(items, 25)) {
        await this.docClient.send(
          new BatchWriteCommand({
            RequestItems: {
              'example-users-v2': chunk.map((item) => ({
                DeleteRequest: {
                  Key: {
                    userId: item['userId'],
                  },
                },
              })),
            },
          })
        );
      }
    }
  }

  async *scanTable(tableName: string) {
    let exclusiveStartKey;
    do {
      const command = new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: exclusiveStartKey,
      });
      const response: ScanCommandOutput = await this.docClient.send(command);
      yield response.Items ?? [];
      exclusiveStartKey = response.LastEvaluatedKey;
    } while (exclusiveStartKey);
  }
}
