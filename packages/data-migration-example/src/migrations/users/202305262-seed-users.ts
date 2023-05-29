import {
  Migration,
  DynamoDBMigrationBase,
  LifecycleHook,
} from '@nxlv/data-migration';
import { chunks } from '@nxlv/util';
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';

@Migration({
  namespace: 'users',
  version: 202305262,
  name: 'seed-users',
  description: 'Seed users',
  lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
})
export default class extends DynamoDBMigrationBase {
  docClient: DynamoDBDocumentClient;

  constructor() {
    super();

    this.docClient = DynamoDBDocumentClient.from(this.client);
  }

  async up(): Promise<void> {
    const range = Array.from({ length: 100 }, (_, i) => i + 1);

    for (const chunk of chunks(range, 25)) {
      await this.docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            'example-users': chunk.map((i) => ({
              PutRequest: {
                Item: {
                  id: `user-${i}`,
                  name: `User ${i}`,
                },
              },
            })),
          },
        })
      );
    }
  }

  async down(): Promise<void> {
    const range = Array.from({ length: 100 }, (_, i) => i + 1);

    for (const chunk of chunks(range, 25)) {
      await this.docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            'example-users': chunk.map((i) => ({
              DeleteRequest: {
                Key: {
                  id: `user-${i}`,
                },
              },
            })),
          },
        })
      );
    }
  }
}
