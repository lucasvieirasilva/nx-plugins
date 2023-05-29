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
  version: 202305265,
  name: 'seed-users-remote',
  description: 'Seed users in remote environment',
  lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
  remote: {
    type: 'ecs',
    config: {
      cluster: {
        value: 'migration-remote',
      },
      cpu: 512,
      memory: 1024,
      networkMode: 'awsvpc',
      executionRoleArn: {
        value: 'arn:aws:iam::557763828095:role/ECSExecutionRole',
      },
      securityGroupId: {
        value: 'sg-03169b74dcfbaa171',
      },
      subnetIds: {
        value:
          'subnet-097b615616ac8f87e,subnet-0c5a21f47641cdba7,subnet-096ef534a29669a33',
      },
      taskRoleArn: {
        value: 'arn:aws:iam::557763828095:role/ECSTaskRole',
      },
      assignPublicIp: 'ENABLED',
    },
  },
})
export default class extends DynamoDBMigrationBase {
  docClient: DynamoDBDocumentClient;

  constructor() {
    super();

    this.docClient = DynamoDBDocumentClient.from(this.client);
  }

  async up(): Promise<void> {
    const range = Array.from({ length: 300 }, (_, i) => i + 1);

    this.logger.info('Seeding users');
    let count = 0;
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

      count += chunk.length;
    }

    this.logger.info(`Seeded ${count} users`);
  }

  async down(): Promise<void> {
    const range = Array.from({ length: 300 }, (_, i) => i + 1);

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
