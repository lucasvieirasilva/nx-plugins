const buildMock = jest.fn();
const fsExistsSyncMock = jest.fn();
const fsUnlinkSyncMock = jest.fn();
const fsCreateWriteStreamMock = jest.fn(() => ({
  on: jest.fn(),
}));
const fsReadFileSyncMock = jest.fn();

jest.mock('esbuild', () => ({
  build: buildMock,
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: fsExistsSyncMock,
  unlinkSync: fsUnlinkSyncMock,
  createWriteStream: fsCreateWriteStreamMock,
  readFileSync: fsReadFileSyncMock,
}));

const archiverDirectoryMock = jest.fn();

jest.mock('archiver', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    directory: archiverDirectoryMock,
    finalize: jest.fn(),
  })),
}));

const waitUntilTableExistsMock = jest.fn();
const waitUntilTableNotExistsMock = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => ({
  ...jest.requireActual('@aws-sdk/client-dynamodb'),
  waitUntilTableExists: waitUntilTableExistsMock,
  waitUntilTableNotExists: waitUntilTableNotExistsMock,
}));

import {
  DynamoDBClient,
  RestoreTableToPointInTimeCommand,
  ListBackupsCommand,
  RestoreTableFromBackupCommand,
  CreateBackupCommand,
  DescribeBackupCommand,
  UpdateTableCommand,
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  ListTagsOfResourceCommand,
  TagResourceCommand,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBStreamsClient,
  ListStreamsCommand,
} from '@aws-sdk/client-dynamodb-streams';
import {
  LambdaClient,
  GetFunctionCommand,
  CreateFunctionCommand,
  CreateEventSourceMappingCommand,
  ListEventSourceMappingsCommand,
  DeleteEventSourceMappingCommand,
  DeleteFunctionCommand,
} from '@aws-sdk/client-lambda';
import {
  IAMClient,
  GetRoleCommand,
  CreateRoleCommand,
  PutRolePolicyCommand,
  ListRolePoliciesCommand,
  DeleteRolePolicyCommand,
  DeleteRoleCommand,
} from '@aws-sdk/client-iam';
import {
  SSMClient,
  DeleteParameterCommand,
  PutParameterCommand,
} from '@aws-sdk/client-ssm';
import 'aws-sdk-client-mock-jest';
import { mockClient } from 'aws-sdk-client-mock';
import { CLILogger } from '../logger';
import { Migration } from '../migration';
import { LifecycleHook } from '../types';
import { DynamoDBMigrationBase } from './migration';
import path from 'path';

class AwsErrorMock extends Error {
  constructor(public name: string) {
    super(name);
  }
}

describe('DynamoDBMigrationBase', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    process.env = {
      ...originalEnv,
      ENV: 'test',
      KMS_KEY_ID: 'kms-key-id',
      AWS_REGION: 'us-east-1',
    };
  });

  afterEach(() => {
    jest.useRealTimers();
    process.env = originalEnv;
  });

  it('should be defined', () => {
    expect(DynamoDBMigrationBase).toBeDefined();
  });

  it('should use default region', () => {
    delete process.env.AWS_REGION;
    class MyClass extends DynamoDBMigrationBase {
      constructor() {
        super();
        this.logger = new CLILogger('info');
      }

      async up() {
        // noop
      }

      async down() {
        // noop
      }
    }

    const migration = new MyClass();
    expect(migration.region).toEqual('us-east-1');
  });

  describe('delete parameter', () => {
    it('should delete a ssm parameter', async () => {
      @Migration({
        name: 'name',
        namespace: 'namespace',
        version: 202304031,
        lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
      })
      class MyMigration extends DynamoDBMigrationBase {
        constructor() {
          super();
          this.logger = new CLILogger('info');
        }

        async up() {
          // noop
        }

        async down() {
          await this.deleteStreamArnFromSSM('test');
        }
      }

      const migration = new MyMigration();
      const dynamodbStreamsMock = mockClient(DynamoDBStreamsClient);
      const ssmMock = mockClient(SSMClient);

      dynamodbStreamsMock.on(ListStreamsCommand).resolvesOnce({
        Streams: [
          {
            StreamArn:
              'arn:aws:dynamodb:us-east-1:123456789012:table/development_myTable/stream/2021-01-01T00:00:00.000',
          },
        ],
      });
      ssmMock.on(DeleteParameterCommand).resolvesOnce({});

      await migration.down();

      expect(ssmMock).toHaveReceivedCommandWith(DeleteParameterCommand, {
        Name: 'TestStream',
      });
    });

    it('should delete a ssm parameter without ENV', async () => {
      delete process.env.ENV;

      @Migration({
        name: 'name',
        namespace: 'namespace',
        version: 202304031,
        lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
      })
      class MyMigration extends DynamoDBMigrationBase {
        constructor() {
          super();
          this.logger = new CLILogger('info');
        }

        async up() {
          // noop
        }

        async down() {
          await this.deleteStreamArnFromSSM('test');
        }
      }

      const migration = new MyMigration();
      const dynamodbStreamsMock = mockClient(DynamoDBStreamsClient);
      const ssmMock = mockClient(SSMClient);

      dynamodbStreamsMock.on(ListStreamsCommand).resolvesOnce({
        Streams: [
          {
            StreamArn:
              'arn:aws:dynamodb:us-east-1:123456789012:table/development_myTable/stream/2021-01-01T00:00:00.000',
          },
        ],
      });
      ssmMock.on(DeleteParameterCommand).resolvesOnce({});

      await migration.down();

      expect(ssmMock).toHaveReceivedCommandWith(DeleteParameterCommand, {
        Name: 'TestStream',
      });
    });
  });

  describe('update table', () => {
    it('should update a table', async () => {
      @Migration({
        name: 'name',
        namespace: 'namespace',
        version: 202304031,
        lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
      })
      class MyMigration extends DynamoDBMigrationBase {
        constructor() {
          super();
          this.logger = new CLILogger('info');
        }

        async up() {
          await this.updateTable({
            TableName: 'test',
          });
        }

        async down() {
          // noop
        }
      }

      const migration = new MyMigration();
      const dynamoDbMock = mockClient(DynamoDBClient);

      dynamoDbMock.on(UpdateTableCommand).resolvesOnce({});

      await migration.up();

      expect(dynamoDbMock).toHaveReceivedCommandWith(UpdateTableCommand, {
        TableName: 'test',
      });
    });

    it('should update a table and enable stream', async () => {
      @Migration({
        name: 'name',
        namespace: 'namespace',
        version: 202304031,
        lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
      })
      class MyMigration extends DynamoDBMigrationBase {
        constructor() {
          super();
          this.logger = new CLILogger('info');
        }

        async up() {
          await this.updateTable({
            TableName: 'test',
            StreamSpecification: {
              StreamViewType: 'NEW_IMAGE',
              StreamEnabled: true,
            },
          });
        }

        async down() {
          // noop
        }
      }

      const migration = new MyMigration();

      const dynamoDbMock = mockClient(DynamoDBClient);
      const dynamodbStreamsMock = mockClient(DynamoDBStreamsClient);
      const ssmMock = mockClient(SSMClient);

      dynamoDbMock.on(UpdateTableCommand).resolvesOnce({});
      dynamodbStreamsMock.on(ListStreamsCommand).resolvesOnce({
        Streams: [
          {
            StreamArn:
              'arn:aws:dynamodb:us-east-1:123456789012:table/development_myTable/stream/2021-01-01T00:00:00.000',
          },
        ],
      });
      ssmMock.on(PutParameterCommand).resolvesOnce({});

      await migration.up();

      expect(dynamoDbMock).toHaveReceivedCommandWith(UpdateTableCommand, {
        TableName: 'test',
        StreamSpecification: {
          StreamViewType: 'NEW_IMAGE',
          StreamEnabled: true,
        },
      });
      expect(ssmMock).toHaveReceivedCommandWith(PutParameterCommand, {
        Name: 'TestStream',
        Value:
          'arn:aws:dynamodb:us-east-1:123456789012:table/development_myTable/stream/2021-01-01T00:00:00.000',
        Type: 'String',
        Overwrite: true,
      });
    });
  });

  describe('create table', () => {
    it('should create a table', async () => {
      @Migration({
        name: 'name',
        namespace: 'namespace',
        version: 202304031,
        lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
      })
      class MyMigration extends DynamoDBMigrationBase {
        constructor() {
          super();
          this.logger = new CLILogger('info');
        }

        async up() {
          await this.createTable({
            TableName: 'test',
            KeySchema: [
              {
                AttributeName: 'id',
                KeyType: 'HASH',
              },
            ],
            AttributeDefinitions: [
              {
                AttributeName: 'id',
                AttributeType: 'S',
              },
            ],
          });
        }

        async down() {
          // noop
        }
      }

      const migration = new MyMigration();

      const dynamoDbMock = mockClient(DynamoDBClient);

      dynamoDbMock.on(CreateTableCommand).resolvesOnce({});

      waitUntilTableExistsMock.mockResolvedValueOnce({});

      await migration.up();

      expect(waitUntilTableExistsMock).toHaveBeenCalledWith(expect.anything(), {
        TableName: 'test',
      });
      expect(dynamoDbMock).toHaveReceivedCommandWith(CreateTableCommand, {
        AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
        KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
        TableName: 'test',
        Tags: [
          { Key: 'migration:name', Value: 'name' },
          { Key: 'migration:namespace', Value: 'namespace' },
          { Key: 'migration:version', Value: '202304031' },
          { Key: 'migration:path', Value: undefined },
          { Key: 'migration:created-by', Value: 'migration' },
        ],
      });
    });

    it('should create a table with stream enabled', async () => {
      @Migration({
        name: 'name',
        namespace: 'namespace',
        version: 202304031,
        lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
      })
      class MyMigration extends DynamoDBMigrationBase {
        constructor() {
          super();
          this.logger = new CLILogger('info');
        }

        async up() {
          await this.createTable({
            TableName: 'test_myTable',
            KeySchema: [
              {
                AttributeName: 'id',
                KeyType: 'HASH',
              },
            ],
            AttributeDefinitions: [
              {
                AttributeName: 'id',
                AttributeType: 'S',
              },
            ],
            StreamSpecification: {
              StreamEnabled: true,
              StreamViewType: 'NEW_AND_OLD_IMAGES',
            },
          });
        }

        async down() {
          // noop
        }
      }

      const migration = new MyMigration();

      const dynamoDbMock = mockClient(DynamoDBClient);
      const dynamodbStreamsMock = mockClient(DynamoDBStreamsClient);
      const ssmMock = mockClient(SSMClient);

      dynamoDbMock.on(CreateTableCommand).resolvesOnce({});

      waitUntilTableExistsMock.mockResolvedValueOnce({});

      dynamodbStreamsMock.on(ListStreamsCommand).resolvesOnce({
        Streams: [
          {
            StreamArn:
              'arn:aws:dynamodb:us-east-1:123456789012:table/test_myTable/stream/2021-01-01T00:00:00.000',
          },
        ],
      });
      ssmMock.on(PutParameterCommand).resolvesOnce({});

      await migration.up();

      expect(waitUntilTableExistsMock).toHaveBeenCalledWith(expect.anything(), {
        TableName: 'test_myTable',
      });
      expect(dynamoDbMock).toHaveReceivedCommandWith(CreateTableCommand, {
        AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
        KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
        TableName: 'test_myTable',
        Tags: [
          { Key: 'migration:name', Value: 'name' },
          { Key: 'migration:namespace', Value: 'namespace' },
          { Key: 'migration:version', Value: '202304031' },
          { Key: 'migration:path', Value: undefined },
          { Key: 'migration:created-by', Value: 'migration' },
        ],
        StreamSpecification: {
          StreamEnabled: true,
          StreamViewType: 'NEW_AND_OLD_IMAGES',
        },
      });

      expect(dynamodbStreamsMock).toHaveReceivedCommandWith(
        ListStreamsCommand,
        {
          TableName: 'test_myTable',
        }
      );
      expect(ssmMock).toHaveReceivedCommandWith(PutParameterCommand, {
        Name: 'MyTableStream',
        Value:
          'arn:aws:dynamodb:us-east-1:123456789012:table/test_myTable/stream/2021-01-01T00:00:00.000',
        Type: 'String',
        Overwrite: true,
      });
    });

    it('should create a table with stream enabled and store ssm flag set to false', async () => {
      @Migration({
        name: 'name',
        namespace: 'namespace',
        version: 202304031,
        lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
      })
      class MyMigration extends DynamoDBMigrationBase {
        constructor() {
          super();
          this.logger = new CLILogger('info');
        }

        async up() {
          await this.createTable(
            {
              TableName: 'test_mytable',
              KeySchema: [
                {
                  AttributeName: 'id',
                  KeyType: 'HASH',
                },
              ],
              AttributeDefinitions: [
                {
                  AttributeName: 'id',
                  AttributeType: 'S',
                },
              ],
              StreamSpecification: {
                StreamEnabled: true,
                StreamViewType: 'NEW_AND_OLD_IMAGES',
              },
            },
            false
          );
        }

        async down() {
          // noop
        }
      }

      const migration = new MyMigration();

      const dynamoDbMock = mockClient(DynamoDBClient);
      const dynamodbStreamsMock = mockClient(DynamoDBStreamsClient);
      const ssmMock = mockClient(SSMClient);

      dynamoDbMock.on(CreateTableCommand).resolvesOnce({});

      waitUntilTableExistsMock.mockResolvedValueOnce({});

      await migration.up();

      expect(waitUntilTableExistsMock).toHaveBeenCalledWith(expect.anything(), {
        TableName: 'test_mytable',
      });
      expect(dynamoDbMock).toHaveReceivedCommandWith(CreateTableCommand, {
        AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
        KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
        TableName: 'test_mytable',
        Tags: [
          { Key: 'migration:name', Value: 'name' },
          { Key: 'migration:namespace', Value: 'namespace' },
          { Key: 'migration:version', Value: '202304031' },
          { Key: 'migration:path', Value: undefined },
          { Key: 'migration:created-by', Value: 'migration' },
        ],
        StreamSpecification: {
          StreamEnabled: true,
          StreamViewType: 'NEW_AND_OLD_IMAGES',
        },
      });

      expect(dynamodbStreamsMock).not.toHaveReceivedCommand(ListStreamsCommand);
      expect(ssmMock).not.toHaveReceivedCommand(PutParameterCommand);
    });

    it('should create a table with stream enabled without ENV', async () => {
      delete process.env.ENV;

      @Migration({
        name: 'name',
        namespace: 'namespace',
        version: 202304031,
        lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
      })
      class MyMigration extends DynamoDBMigrationBase {
        constructor() {
          super();
          this.logger = new CLILogger('info');
        }

        async up() {
          await this.createTable({
            TableName: 'development_myTable',
            KeySchema: [
              {
                AttributeName: 'id',
                KeyType: 'HASH',
              },
            ],
            AttributeDefinitions: [
              {
                AttributeName: 'id',
                AttributeType: 'S',
              },
            ],
            StreamSpecification: {
              StreamEnabled: true,
              StreamViewType: 'NEW_AND_OLD_IMAGES',
            },
          });
        }

        async down() {
          // noop
        }
      }

      const migration = new MyMigration();

      const dynamoDbMock = mockClient(DynamoDBClient);
      const dynamodbStreamsMock = mockClient(DynamoDBStreamsClient);
      const ssmMock = mockClient(SSMClient);

      dynamoDbMock.on(CreateTableCommand).resolvesOnce({});

      waitUntilTableExistsMock.mockResolvedValueOnce({});

      dynamodbStreamsMock.on(ListStreamsCommand).resolvesOnce({
        Streams: [
          {
            StreamArn:
              'arn:aws:dynamodb:us-east-1:123456789012:table/development_myTable/stream/2021-01-01T00:00:00.000',
          },
        ],
      });
      ssmMock.on(PutParameterCommand).resolvesOnce({});

      await migration.up();

      expect(waitUntilTableExistsMock).toHaveBeenCalledWith(expect.anything(), {
        TableName: 'development_myTable',
      });
      expect(dynamoDbMock).toHaveReceivedCommandWith(CreateTableCommand, {
        AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
        KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
        TableName: 'development_myTable',
        Tags: [
          { Key: 'migration:name', Value: 'name' },
          { Key: 'migration:namespace', Value: 'namespace' },
          { Key: 'migration:version', Value: '202304031' },
          { Key: 'migration:path', Value: undefined },
          { Key: 'migration:created-by', Value: 'migration' },
        ],
        StreamSpecification: {
          StreamEnabled: true,
          StreamViewType: 'NEW_AND_OLD_IMAGES',
        },
      });

      expect(dynamodbStreamsMock).toHaveReceivedCommandWith(
        ListStreamsCommand,
        {
          TableName: 'development_myTable',
        }
      );
      expect(ssmMock).toHaveReceivedCommandWith(PutParameterCommand, {
        Name: 'MyTableStream',
        Value:
          'arn:aws:dynamodb:us-east-1:123456789012:table/development_myTable/stream/2021-01-01T00:00:00.000',
        Type: 'String',
        Overwrite: true,
      });
    });
  });

  describe('delete table', () => {
    it('should not delete a table when the table does not exists', async () => {
      @Migration({
        name: 'name',
        namespace: 'namespace',
        version: 202304031,
        lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
      })
      class MyMigration extends DynamoDBMigrationBase {
        constructor() {
          super();
          this.logger = new CLILogger('info');
        }

        async up() {
          await this.deleteTable('test');
        }

        async down() {
          // noop
        }
      }

      const migration = new MyMigration();

      const dynamoDbMock = mockClient(DynamoDBClient);

      dynamoDbMock
        .on(DescribeTableCommand)
        .rejectsOnce(new AwsErrorMock('ResourceNotFoundException'));

      await migration.up();

      expect(dynamoDbMock).toHaveReceivedNthCommandWith(
        1,
        DescribeTableCommand,
        {
          TableName: 'test',
        }
      );
      expect(dynamoDbMock).not.toHaveReceivedCommand(DeleteTableCommand);
    });

    it('should not delete a table when the table exists but was not created by the migration', async () => {
      @Migration({
        name: 'name',
        namespace: 'namespace',
        version: 202304031,
        lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
      })
      class MyMigration extends DynamoDBMigrationBase {
        constructor() {
          super();
          this.logger = new CLILogger('info');
        }

        async up() {
          await this.deleteTable('test');
        }

        async down() {
          // noop
        }
      }

      const migration = new MyMigration();

      const dynamoDbMock = mockClient(DynamoDBClient);

      dynamoDbMock.on(DescribeTableCommand).resolvesOnce({
        Table: {
          TableArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/test',
        },
      });

      dynamoDbMock.on(ListTagsOfResourceCommand).resolvesOnce({
        Tags: [
          {
            Key: 'something',
            Value: 'else',
          },
        ],
      });

      await migration.up();

      expect(dynamoDbMock).toHaveReceivedNthCommandWith(
        1,
        DescribeTableCommand,
        {
          TableName: 'test',
        }
      );
      expect(dynamoDbMock).not.toHaveReceivedCommand(DeleteTableCommand);
    });

    it('should delete a table when the table exists but was not created by the migration and the force flag is true', async () => {
      @Migration({
        name: 'name',
        namespace: 'namespace',
        version: 202304031,
        lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
      })
      class MyMigration extends DynamoDBMigrationBase {
        constructor() {
          super();
          this.logger = new CLILogger('info');
        }

        async up() {
          await this.deleteTable('test', true);
        }

        async down() {
          // noop
        }
      }

      const migration = new MyMigration();

      const dynamoDbMock = mockClient(DynamoDBClient);

      dynamoDbMock.on(DescribeTableCommand).resolvesOnce({
        Table: {
          TableArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/test',
        },
      });

      dynamoDbMock.on(ListTagsOfResourceCommand).resolvesOnce({
        Tags: [
          {
            Key: 'something',
            Value: 'else',
          },
        ],
      });

      waitUntilTableNotExistsMock.mockResolvedValueOnce({});

      await migration.up();

      expect(dynamoDbMock).toHaveReceivedNthCommandWith(
        1,
        DescribeTableCommand,
        {
          TableName: 'test',
        }
      );
      expect(dynamoDbMock).toHaveReceivedNthCommandWith(2, DeleteTableCommand, {
        TableName: 'test',
      });
      expect(waitUntilTableNotExistsMock).toHaveBeenCalledWith(
        expect.anything(),
        {
          TableName: 'test',
        }
      );
    });

    it('should delete a table when the table exists and it is created by the migration', async () => {
      @Migration({
        name: 'name',
        namespace: 'namespace',
        version: 202304031,
        lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
      })
      class MyMigration extends DynamoDBMigrationBase {
        constructor() {
          super();
          this.logger = new CLILogger('info');
        }

        async up() {
          await this.deleteTable('test');
        }

        async down() {
          // noop
        }
      }

      const migration = new MyMigration();

      const dynamoDbMock = mockClient(DynamoDBClient);

      dynamoDbMock.on(DescribeTableCommand).resolvesOnce({
        Table: {
          TableArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/test',
        },
      });

      dynamoDbMock.on(ListTagsOfResourceCommand).resolvesOnce({
        Tags: [
          {
            Key: 'migration:created-by',
            Value: 'migration',
          },
        ],
      });

      waitUntilTableNotExistsMock.mockResolvedValueOnce({});

      await migration.up();

      expect(dynamoDbMock).toHaveReceivedNthCommandWith(
        1,
        DescribeTableCommand,
        {
          TableName: 'test',
        }
      );
      expect(dynamoDbMock).toHaveReceivedNthCommandWith(
        2,
        ListTagsOfResourceCommand,
        {
          ResourceArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/test',
        }
      );
      expect(dynamoDbMock).toHaveReceivedNthCommandWith(3, DeleteTableCommand, {
        TableName: 'test',
      });
      expect(waitUntilTableNotExistsMock).toHaveBeenCalledWith(
        expect.anything(),
        {
          TableName: 'test',
        }
      );
    });
  });

  describe('create backup', () => {
    it('should create a backup', async () => {
      @Migration({
        name: 'name',
        namespace: 'namespace',
        version: 202304031,
        lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
      })
      class MyMigration extends DynamoDBMigrationBase {
        constructor() {
          super();
          this.logger = new CLILogger('info');
        }

        async up() {
          await this.createBackup('test');
        }

        async down() {
          // noop
        }
      }

      const migration = new MyMigration();

      const dynamoDbMock = mockClient(DynamoDBClient);

      dynamoDbMock.on(CreateBackupCommand).resolvesOnce({
        BackupDetails: {
          BackupArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/test',
          BackupStatus: 'CREATING',
          BackupName: 'namespace-name-202304031-migration-backup',
          BackupType: 'USER',
          BackupCreationDateTime: new Date(),
        },
      });

      dynamoDbMock.on(DescribeBackupCommand).resolvesOnce({
        BackupDescription: {
          BackupDetails: {
            BackupArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/test',
            BackupStatus: 'AVAILABLE',
            BackupName: 'namespace-name-202304031-migration-backup',
            BackupType: 'USER',
            BackupCreationDateTime: new Date(),
          },
        },
      });

      const timeoutMock = jest
        .spyOn(global, 'setTimeout')
        .mockImplementation((fn) => fn() as unknown as NodeJS.Timeout);

      await migration.up();

      expect(dynamoDbMock).toHaveReceivedNthCommandWith(
        1,
        CreateBackupCommand,
        {
          BackupName: 'namespace-name-202304031-migration-backup',
          TableName: 'test',
        }
      );

      expect(timeoutMock).toHaveBeenCalledTimes(1);
      expect(dynamoDbMock).toHaveReceivedNthCommandWith(
        2,
        DescribeBackupCommand,
        {
          BackupArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/test',
        }
      );
    });

    it('should throw an error when reach the number of retries', async () => {
      @Migration({
        name: 'name',
        namespace: 'namespace',
        version: 202304031,
        lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
      })
      class MyMigration extends DynamoDBMigrationBase {
        constructor() {
          super();
          this.logger = new CLILogger('info');
        }

        async up() {
          await this.createBackup('test');
        }

        async down() {
          // noop
        }
      }

      const migration = new MyMigration();

      const dynamoDbMock = mockClient(DynamoDBClient);

      dynamoDbMock.on(CreateBackupCommand).resolvesOnce({
        BackupDetails: {
          BackupArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/test',
          BackupStatus: 'CREATING',
          BackupName: 'namespace-name-202304031-migration-backup',
          BackupType: 'USER',
          BackupCreationDateTime: new Date(),
        },
      });

      dynamoDbMock.on(DescribeBackupCommand).resolves({
        BackupDescription: {
          BackupDetails: {
            BackupArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/test',
            BackupStatus: 'CREATING',
            BackupName: 'namespace-name-202304031-migration-backup',
            BackupType: 'USER',
            BackupCreationDateTime: new Date(),
          },
        },
      });

      const timeoutMock = jest
        .spyOn(global, 'setTimeout')
        .mockImplementation((fn) => fn() as unknown as NodeJS.Timeout);

      await expect(migration.up()).rejects.toThrowError(
        'Timeout waiting for backup namespace-name-202304031-migration-backup to be created'
      );

      expect(dynamoDbMock).toHaveReceivedNthCommandWith(
        1,
        CreateBackupCommand,
        {
          BackupName: 'namespace-name-202304031-migration-backup',
          TableName: 'test',
        }
      );

      expect(dynamoDbMock).toHaveReceivedCommandTimes(
        DescribeBackupCommand,
        360
      );
      expect(timeoutMock).toHaveBeenCalledTimes(360);
    });

    it('should throw an error when the backup is was deleted externally', async () => {
      @Migration({
        name: 'name',
        namespace: 'namespace',
        version: 202304031,
        lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
      })
      class MyMigration extends DynamoDBMigrationBase {
        constructor() {
          super();
          this.logger = new CLILogger('info');
        }

        async up() {
          await this.createBackup('test');
        }

        async down() {
          // noop
        }
      }

      const migration = new MyMigration();

      const dynamoDbMock = mockClient(DynamoDBClient);

      dynamoDbMock.on(CreateBackupCommand).resolvesOnce({
        BackupDetails: {
          BackupArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/test',
          BackupStatus: 'CREATING',
          BackupName: 'namespace-name-202304031-migration-backup',
          BackupType: 'USER',
          BackupCreationDateTime: new Date(),
        },
      });

      dynamoDbMock.on(DescribeBackupCommand).resolvesOnce({
        BackupDescription: {
          BackupDetails: {
            BackupArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/test',
            BackupStatus: 'DELETED',
            BackupName: 'namespace-name-202304031-migration-backup',
            BackupType: 'USER',
            BackupCreationDateTime: new Date(),
          },
        },
      });

      const timeoutMock = jest
        .spyOn(global, 'setTimeout')
        .mockImplementation((fn) => fn() as unknown as NodeJS.Timeout);

      await expect(migration.up()).rejects.toThrowError(
        'Backup namespace-name-202304031-migration-backup was deleted externally'
      );

      expect(dynamoDbMock).toHaveReceivedNthCommandWith(
        1,
        CreateBackupCommand,
        {
          BackupName: 'namespace-name-202304031-migration-backup',
          TableName: 'test',
        }
      );

      expect(timeoutMock).toHaveBeenCalledTimes(1);
      expect(dynamoDbMock).toHaveReceivedNthCommandWith(
        2,
        DescribeBackupCommand,
        {
          BackupArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/test',
        }
      );
    });
  });

  describe('restore backup', () => {
    it('should restore a backup', async () => {
      @Migration({
        name: 'name',
        namespace: 'namespace',
        version: 202304031,
        lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
      })
      class MyMigration extends DynamoDBMigrationBase {
        constructor() {
          super();
          this.logger = new CLILogger('info');
        }

        async up() {
          await this.restoreBackup('test');
        }

        async down() {
          // noop
        }
      }

      const migration = new MyMigration();

      const dynamoDbMock = mockClient(DynamoDBClient);

      dynamoDbMock.on(ListBackupsCommand).resolves({
        BackupSummaries: [
          {
            BackupName: 'namespace-name-202304031-migration-backup',
            BackupArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/test',
          },
        ],
      });

      dynamoDbMock.on(RestoreTableFromBackupCommand).resolves({});

      waitUntilTableExistsMock.mockResolvedValueOnce({});

      await migration.up();

      expect(dynamoDbMock).toHaveReceivedNthCommandWith(1, ListBackupsCommand, {
        BackupType: 'ALL',
        TableName: 'test',
      });

      expect(dynamoDbMock).toHaveReceivedNthCommandWith(
        2,
        RestoreTableFromBackupCommand,
        {
          BackupArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/test',
          TargetTableName: 'test',
        }
      );
      expect(waitUntilTableExistsMock).toHaveBeenCalledWith(expect.anything(), {
        TableName: 'test',
      });
    });

    it('should throw an error when the backup cannot be found', async () => {
      @Migration({
        name: 'name',
        namespace: 'namespace',
        version: 202304031,
        lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
      })
      class MyMigration extends DynamoDBMigrationBase {
        constructor() {
          super();
          this.logger = new CLILogger('info');
        }

        async up() {
          await this.restoreBackup('test');
        }

        async down() {
          // noop
        }
      }

      const migration = new MyMigration();

      const dynamoDbMock = mockClient(DynamoDBClient);

      dynamoDbMock.on(ListBackupsCommand).resolves({
        BackupSummaries: [],
      });

      waitUntilTableNotExistsMock.mockResolvedValueOnce({});

      await expect(migration.up()).rejects.toThrowError(
        'Backup namespace-name-202304031-migration-backup not found'
      );

      expect(dynamoDbMock).toHaveReceivedNthCommandWith(1, ListBackupsCommand, {
        BackupType: 'ALL',
        TableName: 'test',
      });

      expect(dynamoDbMock).not.toHaveReceivedCommand(
        RestoreTableFromBackupCommand
      );
      expect(waitUntilTableNotExistsMock).not.toHaveBeenCalled();
    });
  });

  describe('restore point-in-time', () => {
    it('should restore a point-in-time', async () => {
      @Migration({
        name: 'name',
        namespace: 'namespace',
        version: 202304031,
        lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
      })
      class MyMigration extends DynamoDBMigrationBase {
        constructor() {
          super();
          this.logger = new CLILogger('info');
        }

        async up() {
          await this.restoreTablePointInTime({
            SourceTableName: 'source',
            TargetTableName: 'target',
            RestoreDateTime: new Date('2021-01-01T00:00:00.000Z'),
          });
        }

        async down() {
          // noop
        }
      }

      const dynamoDbMock = mockClient(DynamoDBClient);

      dynamoDbMock.on(RestoreTableToPointInTimeCommand).resolves({});
      waitUntilTableExistsMock.mockResolvedValueOnce({});

      const migration = new MyMigration();
      await migration.up();

      expect(dynamoDbMock).toHaveReceivedCommandWith(
        RestoreTableToPointInTimeCommand,
        {
          SourceTableName: 'source',
          TargetTableName: 'target',
          RestoreDateTime: new Date('2021-01-01T00:00:00.000Z'),
        }
      );

      expect(waitUntilTableExistsMock).toHaveBeenCalledWith(expect.anything(), {
        TableName: 'target',
      });
    });
  });

  describe('enable stream transform', () => {
    it('should not enable stream transform when cannot find the stream arn', async () => {
      @Migration({
        name: 'name',
        namespace: 'namespace',
        version: 202304031,
        lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
      })
      class MyMigration extends DynamoDBMigrationBase {
        constructor() {
          super();
          this.logger = new CLILogger('info');
        }

        async up() {
          await this.enableStream('source', 'destination');
        }

        async down() {
          // noop
        }
      }

      const migration = new MyMigration();

      const dynamoDbMock = mockClient(DynamoDBClient);
      const dynamodbStreamsMock = mockClient(DynamoDBStreamsClient);

      dynamoDbMock
        .on(DescribeTableCommand)
        .resolvesOnce({
          Table: {
            TableName: 'source',
            TableArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/source',
          },
        })
        .resolvesOnce({
          Table: {
            TableName: 'destination',
            TableArn:
              'arn:aws:dynamodb:us-east-1:123456789012:table/destination',
          },
        });

      dynamoDbMock.on(ListTagsOfResourceCommand).resolvesOnce({
        Tags: [],
      });

      dynamodbStreamsMock.on(ListStreamsCommand).resolves({});

      waitUntilTableExistsMock.mockResolvedValueOnce({});

      await expect(migration.up()).rejects.toThrowError(
        'No streams found for table source'
      );

      expect(dynamoDbMock).toHaveReceivedNthCommandWith(
        1,
        DescribeTableCommand,
        {
          TableName: 'source',
        }
      );
      expect(dynamoDbMock).toHaveReceivedNthCommandWith(
        2,
        DescribeTableCommand,
        {
          TableName: 'destination',
        }
      );

      expect(dynamoDbMock).toHaveReceivedNthCommandWith(3, UpdateTableCommand, {
        TableName: 'source',
        StreamSpecification: {
          StreamEnabled: true,
          StreamViewType: 'NEW_AND_OLD_IMAGES',
        },
      });

      expect(dynamoDbMock).toHaveReceivedNthCommandWith(
        4,
        ListTagsOfResourceCommand,
        {
          ResourceArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/source',
        }
      );

      expect(dynamoDbMock).toHaveReceivedNthCommandWith(5, TagResourceCommand, {
        ResourceArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/source',
        Tags: [
          {
            Key: 'migration:name',
            Value: 'name',
          },
          {
            Key: 'migration:namespace',
            Value: 'namespace',
          },
          {
            Key: 'migration:version',
            Value: '202304031',
          },
          {
            Key: 'migration:path',
            Value: undefined,
          },
          {
            Key: 'migration:created-by',
            Value: 'migration',
          },
          {
            Key: 'migration:stream-enabled-by',
            Value: 'migration',
          },
        ],
      });

      expect(waitUntilTableExistsMock).toHaveBeenCalledWith(expect.anything(), {
        TableName: 'source',
      });

      expect(dynamodbStreamsMock).toHaveReceivedNthCommandWith(
        1,
        ListStreamsCommand,
        {
          TableName: 'source',
        }
      );
    });

    it('should not enable stream transform when the zip throw an exception', async () => {
      @Migration({
        name: 'name',
        namespace: 'namespace',
        version: 202304031,
        lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
      })
      class MyMigration extends DynamoDBMigrationBase {
        constructor() {
          super();
          this.logger = new CLILogger('info');
          this.path = __filename;
        }

        async up() {
          await this.enableStream('source', 'destination');
        }

        async down() {
          // noop
        }
      }

      const migration = new MyMigration();

      const dynamoDbMock = mockClient(DynamoDBClient);
      const dynamodbStreamsMock = mockClient(DynamoDBStreamsClient);

      dynamoDbMock
        .on(DescribeTableCommand)
        .resolvesOnce({
          Table: {
            TableName: 'source',
            TableArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/source',
            StreamSpecification: {
              StreamEnabled: true,
              StreamViewType: 'NEW_AND_OLD_IMAGES',
            },
          },
        })
        .resolvesOnce({
          Table: {
            TableName: 'destination',
            TableArn:
              'arn:aws:dynamodb:us-east-1:123456789012:table/destination',
          },
        });

      dynamoDbMock.on(ListTagsOfResourceCommand).resolvesOnce({
        Tags: [],
      });

      dynamodbStreamsMock.on(ListStreamsCommand).resolves({
        Streams: [
          {
            StreamArn:
              'arn:aws:dynamodb:us-east-1:123456789012:table/source/stream/2021-01-01T00:00:00.000',
          },
        ],
      });

      fsExistsSyncMock.mockReturnValue(true);

      archiverDirectoryMock.mockImplementation(() => {
        return {
          on: jest.fn((event, callback) => {
            if (event === 'error') {
              callback(new Error('zip error'));
            }

            return {
              pipe: jest.fn(),
            };
          }),
        };
      });

      await expect(migration.up()).rejects.toThrowError('zip error');

      expect(dynamoDbMock).toHaveReceivedNthCommandWith(
        1,
        DescribeTableCommand,
        {
          TableName: 'source',
        }
      );
      expect(dynamoDbMock).toHaveReceivedNthCommandWith(
        2,
        DescribeTableCommand,
        {
          TableName: 'destination',
        }
      );

      expect(dynamoDbMock).not.toHaveReceivedCommand(UpdateTableCommand);

      expect(dynamoDbMock).toHaveReceivedNthCommandWith(
        3,
        ListTagsOfResourceCommand,
        {
          ResourceArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/source',
        }
      );

      expect(dynamoDbMock).toHaveReceivedNthCommandWith(4, TagResourceCommand, {
        ResourceArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/source',
        Tags: [
          {
            Key: 'migration:name',
            Value: 'name',
          },
          {
            Key: 'migration:namespace',
            Value: 'namespace',
          },
          {
            Key: 'migration:version',
            Value: '202304031',
          },
          {
            Key: 'migration:path',
            Value: __filename,
          },
          {
            Key: 'migration:created-by',
            Value: 'migration',
          },
          {
            Key: 'migration:stream-enabled-by',
            Value: 'external',
          },
        ],
      });

      expect(dynamodbStreamsMock).toHaveReceivedNthCommandWith(
        1,
        ListStreamsCommand,
        {
          TableName: 'source',
        }
      );

      expect(buildMock).toHaveBeenCalledTimes(1);
      expect(buildMock).toHaveBeenNthCalledWith(1, {
        bundle: true,
        entryPoints: [__filename.replace('.ts', '.stream.ts')],
        external: ['aws-sdk'],
        format: 'cjs',
        minify: false,
        outfile:
          'dist/packages/data-migration/src/migrator/dynamodb/migration.spec/.staging-stream-lambda/handler.js',
        platform: 'node',
        sourcemap: false,
        target: ['node18'],
      });

      expect(fsExistsSyncMock).toHaveBeenCalledWith(
        path.join(
          process.cwd(),
          'dist/packages/data-migration/src/migrator/dynamodb/migration.spec/migration-namespace-name-202304031-stream.zip'
        )
      );
      expect(fsUnlinkSyncMock).toHaveBeenCalledWith(
        path.join(
          process.cwd(),
          'dist/packages/data-migration/src/migrator/dynamodb/migration.spec/migration-namespace-name-202304031-stream.zip'
        )
      );
    });

    it('should enable stream transform', async () => {
      @Migration({
        name: 'name',
        namespace: 'namespace',
        version: 202304031,
        lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
      })
      class MyMigration extends DynamoDBMigrationBase {
        constructor() {
          super();
          this.logger = new CLILogger('info');
          this.path = __filename;
        }

        async up() {
          await this.enableStream('source', 'destination');
        }

        async down() {
          // noop
        }
      }

      const migration = new MyMigration();

      const dynamoDbMock = mockClient(DynamoDBClient);
      const dynamodbStreamsMock = mockClient(DynamoDBStreamsClient);
      const iamMock = mockClient(IAMClient);
      const lambdaMock = mockClient(LambdaClient);

      dynamoDbMock
        .on(DescribeTableCommand)
        .resolvesOnce({
          Table: {
            TableName: 'source',
            TableArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/source',
            StreamSpecification: {
              StreamEnabled: true,
              StreamViewType: 'NEW_AND_OLD_IMAGES',
            },
          },
        })
        .resolvesOnce({
          Table: {
            TableName: 'destination',
            TableArn:
              'arn:aws:dynamodb:us-east-1:123456789012:table/destination',
          },
        });

      dynamoDbMock.on(ListTagsOfResourceCommand).resolves({
        Tags: [],
      });

      dynamodbStreamsMock.on(ListStreamsCommand).resolves({
        Streams: [
          {
            StreamArn:
              'arn:aws:dynamodb:us-east-1:123456789012:table/source/stream/2021-01-01T00:00:00.000',
          },
        ],
      });

      fsExistsSyncMock.mockReturnValue(false);

      archiverDirectoryMock.mockImplementation(() => {
        return {
          on: jest.fn(() => ({
            pipe: jest.fn(),
          })),
        };
      });

      fsCreateWriteStreamMock.mockImplementation(() => {
        return {
          on: jest.fn((event, callback) => {
            if (event === 'close') {
              callback();
            }
          }),
        };
      });

      iamMock.on(GetRoleCommand).resolves({ Role: {} } as never);
      iamMock.on(ListRolePoliciesCommand).resolves({ PolicyNames: ['policy'] });
      iamMock.on(CreateRoleCommand).resolves({
        Role: {
          Arn: 'arn:aws:iam::123456789012:role/role',
          Path: '/service-role/',
          CreateDate: new Date(),
          RoleId: 'id',
          RoleName: 'role',
        },
      });

      lambdaMock.on(GetFunctionCommand).resolves({});
      lambdaMock.on(ListEventSourceMappingsCommand).resolves({
        EventSourceMappings: [
          {
            UUID: 'uuid',
          },
        ],
      });

      jest
        .spyOn(global, 'setTimeout')
        .mockImplementation((fn) => fn() as unknown as NodeJS.Timeout);

      fsReadFileSyncMock.mockReturnValue('content');

      await migration.up();

      expect(dynamoDbMock).toHaveReceivedNthCommandWith(
        1,
        DescribeTableCommand,
        {
          TableName: 'source',
        }
      );
      expect(dynamoDbMock).toHaveReceivedNthCommandWith(
        2,
        DescribeTableCommand,
        {
          TableName: 'destination',
        }
      );

      expect(dynamoDbMock).not.toHaveReceivedCommand(UpdateTableCommand);

      expect(dynamoDbMock).toHaveReceivedNthCommandWith(
        3,
        ListTagsOfResourceCommand,
        {
          ResourceArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/source',
        }
      );

      expect(dynamoDbMock).toHaveReceivedNthCommandWith(4, TagResourceCommand, {
        ResourceArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/source',
        Tags: [
          {
            Key: 'migration:name',
            Value: 'name',
          },
          {
            Key: 'migration:namespace',
            Value: 'namespace',
          },
          {
            Key: 'migration:version',
            Value: '202304031',
          },
          {
            Key: 'migration:path',
            Value: __filename,
          },
          {
            Key: 'migration:created-by',
            Value: 'migration',
          },
          {
            Key: 'migration:stream-enabled-by',
            Value: 'external',
          },
        ],
      });

      expect(dynamodbStreamsMock).toHaveReceivedNthCommandWith(
        1,
        ListStreamsCommand,
        {
          TableName: 'source',
        }
      );

      expect(buildMock).toHaveBeenCalledTimes(1);
      expect(buildMock).toHaveBeenNthCalledWith(1, {
        bundle: true,
        entryPoints: [__filename.replace('.ts', '.stream.ts')],
        external: ['aws-sdk'],
        format: 'cjs',
        minify: false,
        outfile:
          'dist/packages/data-migration/src/migrator/dynamodb/migration.spec/.staging-stream-lambda/handler.js',
        platform: 'node',
        sourcemap: false,
        target: ['node18'],
      });

      expect(fsExistsSyncMock).toHaveBeenCalledWith(
        path.join(
          process.cwd(),
          'dist/packages/data-migration/src/migrator/dynamodb/migration.spec/migration-namespace-name-202304031-stream.zip'
        )
      );
      expect(fsUnlinkSyncMock).not.toHaveBeenCalled();

      expect(iamMock).toHaveReceivedNthCommandWith(1, GetRoleCommand, {
        RoleName: 'migration-namespace-name-202304031-stream-role',
      });

      expect(iamMock).toHaveReceivedNthCommandWith(2, ListRolePoliciesCommand, {
        RoleName: 'migration-namespace-name-202304031-stream-role',
      });

      expect(iamMock).toHaveReceivedNthCommandWith(3, DeleteRolePolicyCommand, {
        RoleName: 'migration-namespace-name-202304031-stream-role',
        PolicyName: 'policy',
      });

      expect(iamMock).toHaveReceivedNthCommandWith(4, DeleteRoleCommand, {
        RoleName: 'migration-namespace-name-202304031-stream-role',
      });

      expect(iamMock).toHaveReceivedNthCommandWith(5, CreateRoleCommand, {
        AssumeRolePolicyDocument: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { Service: 'lambda.amazonaws.com' },
              Action: 'sts:AssumeRole',
            },
          ],
        }),
        Description:
          'IAM role for migration namespace/name/202304031 stream lambda',
        Path: '/',
        RoleName: 'migration-namespace-name-202304031-stream-role',
        Tags: [
          {
            Key: 'migration:name',
            Value: 'name',
          },
          {
            Key: 'migration:namespace',
            Value: 'namespace',
          },
          {
            Key: 'migration:version',
            Value: '202304031',
          },
          {
            Key: 'migration:path',
            Value: __filename,
          },
          {
            Key: 'migration:created-by',
            Value: 'migration',
          },
        ],
      });

      expect(iamMock).toHaveReceivedNthCommandWith(6, GetRoleCommand, {
        RoleName: 'migration-namespace-name-202304031-stream-role',
      });

      expect(iamMock).toHaveReceivedNthCommandWith(7, PutRolePolicyCommand, {
        PolicyDocument: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Action: [
                'dynamodb:DescribeStream',
                'dynamodb:GetRecords',
                'dynamodb:GetShardIterator',
                'dynamodb:ListStreams',
              ],
              Resource: [
                'arn:aws:dynamodb:us-east-1:123456789012:table/source/stream/2021-01-01T00:00:00.000',
              ],
            },
            {
              Effect: 'Allow',
              Action: [
                'dynamodb:BatchGet*',
                'dynamodb:Get*',
                'dynamodb:Query',
                'dynamodb:Scan',
                'dynamodb:Describe*',
              ],
              Resource: [
                'arn:aws:dynamodb:us-east-1:123456789012:table/source',
                'arn:aws:dynamodb:us-east-1:123456789012:table/destination',
              ],
            },
            {
              Effect: 'Allow',
              Action: [
                'dynamodb:DeleteItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:BatchWrite*',
              ],
              Resource: [
                'arn:aws:dynamodb:us-east-1:123456789012:table/destination',
              ],
            },
            {
              Effect: 'Allow',
              Action: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
              ],
              Resource: ['arn:aws:logs:*:*:*'],
            },
          ],
        }),
        PolicyName: 'migration-stream-lambda',
        RoleName: 'migration-namespace-name-202304031-stream-role',
      });

      expect(lambdaMock).toHaveReceivedNthCommandWith(1, GetFunctionCommand, {
        FunctionName: 'migration-namespace-name-202304031-stream',
      });

      expect(lambdaMock).toHaveReceivedNthCommandWith(
        2,
        ListEventSourceMappingsCommand,
        {
          FunctionName: 'migration-namespace-name-202304031-stream',
        }
      );

      expect(lambdaMock).toHaveReceivedNthCommandWith(
        3,
        DeleteEventSourceMappingCommand,
        {
          UUID: 'uuid',
        }
      );

      expect(lambdaMock).toHaveReceivedNthCommandWith(
        4,
        DeleteFunctionCommand,
        {
          FunctionName: 'migration-namespace-name-202304031-stream',
        }
      );

      expect(lambdaMock).toHaveReceivedNthCommandWith(
        5,
        CreateFunctionCommand,
        {
          Code: {
            ZipFile: 'content' as never,
          },
          Description:
            'Lambda function for migration namespace/name/202304031 stream',
          Environment: {
            Variables: {
              ENV: 'test',
              TARGET_TABLE_NAME: 'destination',
              TRANSFORM_MODULE_PATH: './transform.js',
            },
          },
          FunctionName: 'migration-namespace-name-202304031-stream',
          Handler: 'handler.handler',
          MemorySize: 256,
          Role: 'arn:aws:iam::123456789012:role/role',
          Runtime: 'nodejs18.x',
          Tags: {
            'migration:name': 'name',
            'migration:namespace': 'namespace',
            'migration:path': __filename,
            'migration:version': '202304031',
          },
          Timeout: 60,
        }
      );

      expect(lambdaMock).toHaveReceivedNthCommandWith(
        6,
        CreateEventSourceMappingCommand,
        {
          EventSourceArn:
            'arn:aws:dynamodb:us-east-1:123456789012:table/source/stream/2021-01-01T00:00:00.000',
          FunctionName: 'migration-namespace-name-202304031-stream',
          StartingPosition: 'TRIM_HORIZON',
        }
      );
    });

    it('should enable stream transform and update the source dynamodb table when the stream is not configured using the correct type', async () => {
      @Migration({
        name: 'name',
        namespace: 'namespace',
        version: 202304031,
        lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
      })
      class MyMigration extends DynamoDBMigrationBase {
        constructor() {
          super();
          this.logger = new CLILogger('info');
          this.path = __filename;
        }

        async up() {
          await this.enableStream('source', 'destination');
        }

        async down() {
          // noop
        }
      }

      const migration = new MyMigration();

      const dynamoDbMock = mockClient(DynamoDBClient);
      const dynamodbStreamsMock = mockClient(DynamoDBStreamsClient);
      const iamMock = mockClient(IAMClient);
      const lambdaMock = mockClient(LambdaClient);

      dynamoDbMock
        .on(DescribeTableCommand)
        .resolvesOnce({
          Table: {
            TableName: 'source',
            TableArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/source',
            StreamSpecification: {
              StreamEnabled: true,
              StreamViewType: 'KEYS_ONLY',
            },
          },
        })
        .resolvesOnce({
          Table: {
            TableName: 'destination',
            TableArn:
              'arn:aws:dynamodb:us-east-1:123456789012:table/destination',
          },
        });

      dynamoDbMock.on(ListTagsOfResourceCommand).resolves({
        Tags: [],
      });

      dynamodbStreamsMock.on(ListStreamsCommand).resolves({
        Streams: [
          {
            StreamArn:
              'arn:aws:dynamodb:us-east-1:123456789012:table/source/stream/2021-01-01T00:00:00.000',
          },
        ],
      });

      fsExistsSyncMock.mockReturnValue(false);

      archiverDirectoryMock.mockImplementation(() => {
        return {
          on: jest.fn(() => ({
            pipe: jest.fn(),
          })),
        };
      });

      fsCreateWriteStreamMock.mockImplementation(() => {
        return {
          on: jest.fn((event, callback) => {
            if (event === 'close') {
              callback();
            }
          }),
        };
      });

      iamMock.on(GetRoleCommand).resolves({ Role: {} } as never);
      iamMock.on(ListRolePoliciesCommand).resolves({ PolicyNames: ['policy'] });
      iamMock.on(CreateRoleCommand).resolves({
        Role: {
          Arn: 'arn:aws:iam::123456789012:role/role',
          Path: '/service-role/',
          CreateDate: new Date(),
          RoleId: 'id',
          RoleName: 'role',
        },
      });

      lambdaMock.on(GetFunctionCommand).resolves({});
      lambdaMock.on(ListEventSourceMappingsCommand).resolves({
        EventSourceMappings: [
          {
            UUID: 'uuid',
          },
        ],
      });

      jest
        .spyOn(global, 'setTimeout')
        .mockImplementation((fn) => fn() as unknown as NodeJS.Timeout);

      fsReadFileSyncMock.mockReturnValue('content');

      await migration.up();

      expect(dynamoDbMock).toHaveReceivedNthCommandWith(
        1,
        DescribeTableCommand,
        {
          TableName: 'source',
        }
      );
      expect(dynamoDbMock).toHaveReceivedNthCommandWith(
        2,
        DescribeTableCommand,
        {
          TableName: 'destination',
        }
      );

      expect(dynamoDbMock).toHaveReceivedNthCommandWith(3, UpdateTableCommand, {
        TableName: 'source',
        StreamSpecification: {
          StreamEnabled: true,
          StreamViewType: 'NEW_AND_OLD_IMAGES',
        },
      });

      expect(dynamoDbMock).toHaveReceivedNthCommandWith(
        4,
        ListTagsOfResourceCommand,
        {
          ResourceArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/source',
        }
      );

      expect(dynamoDbMock).toHaveReceivedNthCommandWith(5, TagResourceCommand, {
        ResourceArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/source',
        Tags: [
          {
            Key: 'migration:name',
            Value: 'name',
          },
          {
            Key: 'migration:namespace',
            Value: 'namespace',
          },
          {
            Key: 'migration:version',
            Value: '202304031',
          },
          {
            Key: 'migration:path',
            Value: __filename,
          },
          {
            Key: 'migration:created-by',
            Value: 'migration',
          },
          {
            Key: 'migration:stream-enabled-by',
            Value: 'migration',
          },
        ],
      });

      expect(dynamodbStreamsMock).toHaveReceivedNthCommandWith(
        1,
        ListStreamsCommand,
        {
          TableName: 'source',
        }
      );

      expect(buildMock).toHaveBeenCalledTimes(1);
      expect(buildMock).toHaveBeenNthCalledWith(1, {
        bundle: true,
        entryPoints: [__filename.replace('.ts', '.stream.ts')],
        external: ['aws-sdk'],
        format: 'cjs',
        minify: false,
        outfile:
          'dist/packages/data-migration/src/migrator/dynamodb/migration.spec/.staging-stream-lambda/handler.js',
        platform: 'node',
        sourcemap: false,
        target: ['node18'],
      });

      expect(fsExistsSyncMock).toHaveBeenCalledWith(
        path.join(
          process.cwd(),
          'dist/packages/data-migration/src/migrator/dynamodb/migration.spec/migration-namespace-name-202304031-stream.zip'
        )
      );
      expect(fsUnlinkSyncMock).not.toHaveBeenCalled();

      expect(iamMock).toHaveReceivedNthCommandWith(1, GetRoleCommand, {
        RoleName: 'migration-namespace-name-202304031-stream-role',
      });

      expect(iamMock).toHaveReceivedNthCommandWith(2, ListRolePoliciesCommand, {
        RoleName: 'migration-namespace-name-202304031-stream-role',
      });

      expect(iamMock).toHaveReceivedNthCommandWith(3, DeleteRolePolicyCommand, {
        RoleName: 'migration-namespace-name-202304031-stream-role',
        PolicyName: 'policy',
      });

      expect(iamMock).toHaveReceivedNthCommandWith(4, DeleteRoleCommand, {
        RoleName: 'migration-namespace-name-202304031-stream-role',
      });

      expect(iamMock).toHaveReceivedNthCommandWith(5, CreateRoleCommand, {
        AssumeRolePolicyDocument: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { Service: 'lambda.amazonaws.com' },
              Action: 'sts:AssumeRole',
            },
          ],
        }),
        Description:
          'IAM role for migration namespace/name/202304031 stream lambda',
        Path: '/',
        RoleName: 'migration-namespace-name-202304031-stream-role',
        Tags: [
          {
            Key: 'migration:name',
            Value: 'name',
          },
          {
            Key: 'migration:namespace',
            Value: 'namespace',
          },
          {
            Key: 'migration:version',
            Value: '202304031',
          },
          {
            Key: 'migration:path',
            Value: __filename,
          },
          {
            Key: 'migration:created-by',
            Value: 'migration',
          },
        ],
      });

      expect(iamMock).toHaveReceivedNthCommandWith(6, GetRoleCommand, {
        RoleName: 'migration-namespace-name-202304031-stream-role',
      });

      expect(iamMock).toHaveReceivedNthCommandWith(7, PutRolePolicyCommand, {
        PolicyDocument: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Action: [
                'dynamodb:DescribeStream',
                'dynamodb:GetRecords',
                'dynamodb:GetShardIterator',
                'dynamodb:ListStreams',
              ],
              Resource: [
                'arn:aws:dynamodb:us-east-1:123456789012:table/source/stream/2021-01-01T00:00:00.000',
              ],
            },
            {
              Effect: 'Allow',
              Action: [
                'dynamodb:BatchGet*',
                'dynamodb:Get*',
                'dynamodb:Query',
                'dynamodb:Scan',
                'dynamodb:Describe*',
              ],
              Resource: [
                'arn:aws:dynamodb:us-east-1:123456789012:table/source',
                'arn:aws:dynamodb:us-east-1:123456789012:table/destination',
              ],
            },
            {
              Effect: 'Allow',
              Action: [
                'dynamodb:DeleteItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:BatchWrite*',
              ],
              Resource: [
                'arn:aws:dynamodb:us-east-1:123456789012:table/destination',
              ],
            },
            {
              Effect: 'Allow',
              Action: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
              ],
              Resource: ['arn:aws:logs:*:*:*'],
            },
          ],
        }),
        PolicyName: 'migration-stream-lambda',
        RoleName: 'migration-namespace-name-202304031-stream-role',
      });

      expect(lambdaMock).toHaveReceivedNthCommandWith(1, GetFunctionCommand, {
        FunctionName: 'migration-namespace-name-202304031-stream',
      });

      expect(lambdaMock).toHaveReceivedNthCommandWith(
        2,
        ListEventSourceMappingsCommand,
        {
          FunctionName: 'migration-namespace-name-202304031-stream',
        }
      );

      expect(lambdaMock).toHaveReceivedNthCommandWith(
        3,
        DeleteEventSourceMappingCommand,
        {
          UUID: 'uuid',
        }
      );

      expect(lambdaMock).toHaveReceivedNthCommandWith(
        4,
        DeleteFunctionCommand,
        {
          FunctionName: 'migration-namespace-name-202304031-stream',
        }
      );

      expect(lambdaMock).toHaveReceivedNthCommandWith(
        5,
        CreateFunctionCommand,
        {
          Code: {
            ZipFile: 'content' as never,
          },
          Description:
            'Lambda function for migration namespace/name/202304031 stream',
          Environment: {
            Variables: {
              ENV: 'test',
              TARGET_TABLE_NAME: 'destination',
              TRANSFORM_MODULE_PATH: './transform.js',
            },
          },
          FunctionName: 'migration-namespace-name-202304031-stream',
          Handler: 'handler.handler',
          MemorySize: 256,
          Role: 'arn:aws:iam::123456789012:role/role',
          Runtime: 'nodejs18.x',
          Tags: {
            'migration:name': 'name',
            'migration:namespace': 'namespace',
            'migration:path': __filename,
            'migration:version': '202304031',
          },
          Timeout: 60,
        }
      );

      expect(lambdaMock).toHaveReceivedNthCommandWith(
        6,
        CreateEventSourceMappingCommand,
        {
          EventSourceArn:
            'arn:aws:dynamodb:us-east-1:123456789012:table/source/stream/2021-01-01T00:00:00.000',
          FunctionName: 'migration-namespace-name-202304031-stream',
          StartingPosition: 'TRIM_HORIZON',
        }
      );
    });
  });

  describe('remove stream transform', () => {
    it('should not disable stream, and not remove stream lambda or role when they do not exist', async () => {
      @Migration({
        name: 'name',
        namespace: 'namespace',
        version: 202304032,
        lifecycleHook: LifecycleHook.AFTER_DEPLOY,
        parentVersion: 202304031,
      })
      class MyMigration extends DynamoDBMigrationBase {
        constructor() {
          super();
          this.logger = new CLILogger('info');
          this.path = __filename;
        }

        async up() {
          await this.removeStream('source', 'name', this.parentVersion);
        }

        async down() {
          // noop
        }
      }

      const migration = new MyMigration();

      const dynamoDbMock = mockClient(DynamoDBClient);
      const lambdaMock = mockClient(LambdaClient);
      const iamMock = mockClient(IAMClient);

      dynamoDbMock.on(DescribeTableCommand).resolvesOnce({
        Table: {
          TableName: 'source',
          TableArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/source',
          StreamSpecification: {
            StreamEnabled: true,
          },
        },
      });

      dynamoDbMock.on(ListTagsOfResourceCommand).resolvesOnce({
        Tags: [
          {
            Key: 'migration:stream-enabled-by',
            Value: 'external',
          },
        ],
      });

      lambdaMock
        .on(GetFunctionCommand)
        .rejectsOnce(new AwsErrorMock('ResourceNotFoundException'));
      iamMock
        .on(GetRoleCommand)
        .rejectsOnce(new AwsErrorMock('NoSuchEntityException'));

      await migration.up();

      expect(dynamoDbMock).toHaveReceivedNthCommandWith(
        1,
        DescribeTableCommand,
        {
          TableName: 'source',
        }
      );
      expect(dynamoDbMock).not.toHaveReceivedCommand(UpdateTableCommand);

      expect(dynamoDbMock).toHaveReceivedNthCommandWith(
        2,
        ListTagsOfResourceCommand,
        {
          ResourceArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/source',
        }
      );

      expect(lambdaMock).toHaveReceivedNthCommandWith(1, GetFunctionCommand, {
        FunctionName: 'migration-namespace-name-202304031-stream',
      });

      expect(iamMock).toHaveReceivedNthCommandWith(1, GetRoleCommand, {
        RoleName: 'migration-namespace-name-202304031-stream-role',
      });
    });

    it('should disable stream, and remove stream lambda and role when they exist', async () => {
      @Migration({
        name: 'name',
        namespace: 'namespace',
        version: 202304031,
        lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
      })
      class MyMigration extends DynamoDBMigrationBase {
        constructor() {
          super();
          this.logger = new CLILogger('info');
          this.path = __filename;
        }

        async up() {
          await this.removeStream('source', this.name, this.version);
        }

        async down() {
          // noop
        }
      }

      const migration = new MyMigration();

      const dynamoDbMock = mockClient(DynamoDBClient);
      const lambdaMock = mockClient(LambdaClient);
      const iamMock = mockClient(IAMClient);

      dynamoDbMock.on(DescribeTableCommand).resolvesOnce({
        Table: {
          TableName: 'source',
          TableArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/source',
          StreamSpecification: {
            StreamEnabled: true,
          },
        },
      });

      dynamoDbMock.on(ListTagsOfResourceCommand).resolvesOnce({
        Tags: [
          {
            Key: 'migration:stream-enabled-by',
            Value: 'migration',
          },
        ],
      });

      lambdaMock.on(GetFunctionCommand).resolvesOnce({});
      lambdaMock.on(ListEventSourceMappingsCommand).resolvesOnce({
        EventSourceMappings: [
          {
            UUID: 'uuid',
          },
        ],
      });

      iamMock.on(GetRoleCommand).resolvesOnce({});
      iamMock.on(ListRolePoliciesCommand).resolvesOnce({
        PolicyNames: ['policy'],
      });

      await migration.up();

      expect(dynamoDbMock).toHaveReceivedNthCommandWith(
        1,
        DescribeTableCommand,
        {
          TableName: 'source',
        }
      );
      expect(dynamoDbMock).toHaveReceivedNthCommandWith(
        2,
        ListTagsOfResourceCommand,
        {
          ResourceArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/source',
        }
      );
      expect(dynamoDbMock).toHaveReceivedNthCommandWith(3, UpdateTableCommand, {
        TableName: 'source',
        StreamSpecification: {
          StreamEnabled: false,
        },
      });

      expect(lambdaMock).toHaveReceivedNthCommandWith(1, GetFunctionCommand, {
        FunctionName: 'migration-namespace-name-202304031-stream',
      });

      expect(lambdaMock).toHaveReceivedNthCommandWith(
        2,
        ListEventSourceMappingsCommand,
        {
          FunctionName: 'migration-namespace-name-202304031-stream',
        }
      );

      expect(lambdaMock).toHaveReceivedNthCommandWith(
        3,
        DeleteEventSourceMappingCommand,
        {
          UUID: 'uuid',
        }
      );

      expect(lambdaMock).toHaveReceivedNthCommandWith(
        4,
        DeleteFunctionCommand,
        {
          FunctionName: 'migration-namespace-name-202304031-stream',
        }
      );

      expect(iamMock).toHaveReceivedNthCommandWith(1, GetRoleCommand, {
        RoleName: 'migration-namespace-name-202304031-stream-role',
      });

      expect(iamMock).toHaveReceivedNthCommandWith(2, ListRolePoliciesCommand, {
        RoleName: 'migration-namespace-name-202304031-stream-role',
      });

      expect(iamMock).toHaveReceivedNthCommandWith(3, DeleteRolePolicyCommand, {
        RoleName: 'migration-namespace-name-202304031-stream-role',
        PolicyName: 'policy',
      });

      expect(iamMock).toHaveReceivedNthCommandWith(4, DeleteRoleCommand, {
        RoleName: 'migration-namespace-name-202304031-stream-role',
      });
    });

    it('should not disable stream, and remove stream lambda and role when they exist', async () => {
      @Migration({
        name: 'name',
        namespace: 'namespace',
        version: 202304031,
        lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
      })
      class MyMigration extends DynamoDBMigrationBase {
        constructor() {
          super();
          this.logger = new CLILogger('info');
          this.path = __filename;
        }

        async up() {
          await this.removeStream('source', this.name, this.version);
        }

        async down() {
          // noop
        }
      }

      const migration = new MyMigration();

      const dynamoDbMock = mockClient(DynamoDBClient);
      const lambdaMock = mockClient(LambdaClient);
      const iamMock = mockClient(IAMClient);

      dynamoDbMock.on(DescribeTableCommand).resolvesOnce({
        Table: {
          TableName: 'source',
          TableArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/source',
        },
      });

      dynamoDbMock.on(ListTagsOfResourceCommand).resolvesOnce({
        Tags: [
          {
            Key: 'migration:stream-enabled-by',
            Value: 'migration',
          },
        ],
      });

      lambdaMock.on(GetFunctionCommand).resolvesOnce({});
      lambdaMock.on(ListEventSourceMappingsCommand).resolvesOnce({
        EventSourceMappings: [
          {
            UUID: 'uuid',
          },
        ],
      });
      iamMock.on(GetRoleCommand).resolvesOnce({});
      iamMock.on(ListRolePoliciesCommand).resolvesOnce({
        PolicyNames: ['policy'],
      });

      await migration.up();

      expect(dynamoDbMock).toHaveReceivedNthCommandWith(
        1,
        DescribeTableCommand,
        {
          TableName: 'source',
        }
      );
      expect(dynamoDbMock).not.toHaveReceivedCommand(UpdateTableCommand);

      expect(dynamoDbMock).toHaveReceivedNthCommandWith(
        2,
        ListTagsOfResourceCommand,
        {
          ResourceArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/source',
        }
      );

      expect(lambdaMock).toHaveReceivedNthCommandWith(1, GetFunctionCommand, {
        FunctionName: 'migration-namespace-name-202304031-stream',
      });

      expect(lambdaMock).toHaveReceivedNthCommandWith(
        2,
        ListEventSourceMappingsCommand,
        {
          FunctionName: 'migration-namespace-name-202304031-stream',
        }
      );

      expect(lambdaMock).toHaveReceivedNthCommandWith(
        3,
        DeleteEventSourceMappingCommand,
        {
          UUID: 'uuid',
        }
      );

      expect(lambdaMock).toHaveReceivedNthCommandWith(
        4,
        DeleteFunctionCommand,
        {
          FunctionName: 'migration-namespace-name-202304031-stream',
        }
      );

      expect(iamMock).toHaveReceivedNthCommandWith(1, GetRoleCommand, {
        RoleName: 'migration-namespace-name-202304031-stream-role',
      });

      expect(iamMock).toHaveReceivedNthCommandWith(2, ListRolePoliciesCommand, {
        RoleName: 'migration-namespace-name-202304031-stream-role',
      });

      expect(iamMock).toHaveReceivedNthCommandWith(3, DeleteRolePolicyCommand, {
        RoleName: 'migration-namespace-name-202304031-stream-role',
        PolicyName: 'policy',
      });

      expect(iamMock).toHaveReceivedNthCommandWith(4, DeleteRoleCommand, {
        RoleName: 'migration-namespace-name-202304031-stream-role',
      });
    });
  });

  describe('describe table', () => {
    it('should return table description', async () => {
      @Migration({
        name: 'name',
        namespace: 'namespace',
        version: 202304031,
        lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
      })
      class MyMigration extends DynamoDBMigrationBase {
        constructor() {
          super();
          this.logger = new CLILogger('info');
        }

        async up() {
          await this.describeTable('test');
        }

        async down() {
          // noop
        }
      }

      const migration = new MyMigration();

      const dynamoDbMock = mockClient(DynamoDBClient);

      dynamoDbMock.on(DescribeTableCommand).resolvesOnce({
        Table: {
          TableName: 'test',
        },
      });

      await migration.up();

      expect(dynamoDbMock).toHaveReceivedNthCommandWith(
        1,
        DescribeTableCommand,
        {
          TableName: 'test',
        }
      );
    });

    it('should return null when the table cannot be found', async () => {
      @Migration({
        name: 'name',
        namespace: 'namespace',
        version: 202304031,
        lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
      })
      class MyMigration extends DynamoDBMigrationBase {
        constructor() {
          super();
          this.logger = new CLILogger('info');
        }

        async up() {
          await this.describeTable('test');
        }

        async down() {
          // noop
        }
      }

      const migration = new MyMigration();

      const dynamoDbMock = mockClient(DynamoDBClient);

      dynamoDbMock
        .on(DescribeTableCommand)
        .rejectsOnce(new AwsErrorMock('ResourceNotFoundException'));

      await migration.up();

      expect(dynamoDbMock).toHaveReceivedNthCommandWith(
        1,
        DescribeTableCommand,
        {
          TableName: 'test',
        }
      );
    });

    it('should throw an exception when an unmanaged error happens', async () => {
      @Migration({
        name: 'name',
        namespace: 'namespace',
        version: 202304031,
        lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
      })
      class MyMigration extends DynamoDBMigrationBase {
        constructor() {
          super();
          this.logger = new CLILogger('info');
        }

        async up() {
          await this.describeTable('test');
        }

        async down() {
          // noop
        }
      }

      const migration = new MyMigration();

      const dynamoDbMock = mockClient(DynamoDBClient);

      dynamoDbMock
        .on(DescribeTableCommand)
        .rejectsOnce(new Error('Internal server error'));

      await expect(migration.up()).rejects.toThrowError(
        'Internal server error'
      );

      expect(dynamoDbMock).toHaveReceivedNthCommandWith(
        1,
        DescribeTableCommand,
        {
          TableName: 'test',
        }
      );
    });
  });

  describe('iam role exists', () => {
    it('should return true', async () => {
      @Migration({
        name: 'name',
        namespace: 'namespace',
        version: 202304031,
        lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
      })
      class MyMigration extends DynamoDBMigrationBase {
        constructor() {
          super();
          this.logger = new CLILogger('info');
        }

        async up() {
          const result = await this.iamRoleExists('test');
          expect(result).toBe(true);
        }

        async down() {
          // noop
        }
      }

      const migration = new MyMigration();

      const iamMock = mockClient(IAMClient);

      iamMock.on(GetRoleCommand).resolvesOnce({});

      await migration.up();

      expect(iamMock).toHaveReceivedNthCommandWith(1, GetRoleCommand, {
        RoleName: 'test',
      });
    });

    it('should return false when the role cannot be found', async () => {
      @Migration({
        name: 'name',
        namespace: 'namespace',
        version: 202304031,
        lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
      })
      class MyMigration extends DynamoDBMigrationBase {
        constructor() {
          super();
          this.logger = new CLILogger('info');
        }

        async up() {
          const result = await this.iamRoleExists('test');
          expect(result).toBe(false);
        }

        async down() {
          // noop
        }
      }

      const migration = new MyMigration();

      const iamMock = mockClient(IAMClient);

      iamMock
        .on(GetRoleCommand)
        .rejectsOnce(new AwsErrorMock('NoSuchEntityException'));

      await migration.up();

      expect(iamMock).toHaveReceivedNthCommandWith(1, GetRoleCommand, {
        RoleName: 'test',
      });
    });

    it('should throw an exception when an unmanaged error happens', async () => {
      @Migration({
        name: 'name',
        namespace: 'namespace',
        version: 202304031,
        lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
      })
      class MyMigration extends DynamoDBMigrationBase {
        constructor() {
          super();
          this.logger = new CLILogger('info');
        }

        async up() {
          await this.iamRoleExists('test');
        }

        async down() {
          // noop
        }
      }

      const migration = new MyMigration();

      const iamMock = mockClient(IAMClient);
      iamMock
        .on(GetRoleCommand)
        .rejectsOnce(new Error('Internal server error'));

      await expect(migration.up()).rejects.toThrowError(
        'Internal server error'
      );

      expect(iamMock).toHaveReceivedNthCommandWith(1, GetRoleCommand, {
        RoleName: 'test',
      });
    });
  });

  describe('function exists', () => {
    it('should return true', async () => {
      @Migration({
        name: 'name',
        namespace: 'namespace',
        version: 202304031,
        lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
      })
      class MyMigration extends DynamoDBMigrationBase {
        constructor() {
          super();
          this.logger = new CLILogger('info');
        }

        async up() {
          const result = await this.functionExists('test');
          expect(result).toBe(true);
        }

        async down() {
          // noop
        }
      }

      const migration = new MyMigration();

      const lambdaMock = mockClient(LambdaClient);

      lambdaMock.on(GetFunctionCommand).resolvesOnce({});

      await migration.up();

      expect(lambdaMock).toHaveReceivedNthCommandWith(1, GetFunctionCommand, {
        FunctionName: 'test',
      });
    });

    it('should return false when the role cannot be found', async () => {
      @Migration({
        name: 'name',
        namespace: 'namespace',
        version: 202304031,
        lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
      })
      class MyMigration extends DynamoDBMigrationBase {
        constructor() {
          super();
          this.logger = new CLILogger('info');
        }

        async up() {
          const result = await this.functionExists('test');
          expect(result).toBe(false);
        }

        async down() {
          // noop
        }
      }

      const migration = new MyMigration();

      const lambdaMock = mockClient(LambdaClient);

      lambdaMock
        .on(GetFunctionCommand)
        .rejectsOnce(new AwsErrorMock('ResourceNotFoundException'));

      await migration.up();

      expect(lambdaMock).toHaveReceivedNthCommandWith(1, GetFunctionCommand, {
        FunctionName: 'test',
      });
    });

    it('should throw an exception when an unmanaged error happens', async () => {
      @Migration({
        name: 'name',
        namespace: 'namespace',
        version: 202304031,
        lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
      })
      class MyMigration extends DynamoDBMigrationBase {
        constructor() {
          super();
          this.logger = new CLILogger('info');
        }

        async up() {
          await this.functionExists('test');
        }

        async down() {
          // noop
        }
      }

      const migration = new MyMigration();

      const lambdaMock = mockClient(LambdaClient);

      lambdaMock
        .on(GetFunctionCommand)
        .rejectsOnce(new Error('Internal server error'));

      await expect(migration.up()).rejects.toThrowError(
        'Internal server error'
      );

      expect(lambdaMock).toHaveReceivedNthCommandWith(1, GetFunctionCommand, {
        FunctionName: 'test',
      });
    });
  });

  describe('retry', () => {
    it('should not retry when the function succeeds', async () => {
      @Migration({
        name: 'name',
        namespace: 'namespace',
        version: 202304031,
        lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
      })
      class MyMigration extends DynamoDBMigrationBase {
        constructor() {
          super();
          this.logger = new CLILogger('info');
        }

        async up() {
          await this.retry(async () => {
            // noop
          });
        }

        async down() {
          // noop
        }
      }

      const timeoutMock = jest
        .spyOn(global, 'setTimeout')
        .mockImplementation((fn) => fn() as unknown as NodeJS.Timeout);

      const migration = new MyMigration();
      await migration.up();

      expect(timeoutMock).not.toHaveBeenCalled();
    });

    it('should retry when the function fails and succeed in the next call', async () => {
      @Migration({
        name: 'name',
        namespace: 'namespace',
        version: 202304031,
        lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
      })
      class MyMigration extends DynamoDBMigrationBase {
        constructor() {
          super();
          this.logger = new CLILogger('info');
        }

        async up() {
          const fn = jest.fn();
          fn.mockRejectedValueOnce(
            new Error('Internal server error')
          ).mockResolvedValueOnce({});

          await this.retry(fn);
        }

        async down() {
          // noop
        }
      }

      const timeoutMock = jest
        .spyOn(global, 'setTimeout')
        .mockImplementation((fn) => fn() as unknown as NodeJS.Timeout);

      const migration = new MyMigration();
      await migration.up();

      expect(timeoutMock).toHaveBeenCalledTimes(1);
    });

    it('should throw an exception when all fails all the times', async () => {
      @Migration({
        name: 'name',
        namespace: 'namespace',
        version: 202304031,
        lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
      })
      class MyMigration extends DynamoDBMigrationBase {
        constructor() {
          super();
          this.logger = new CLILogger('info');
        }

        async up() {
          const fn = jest.fn();
          fn.mockRejectedValue(new Error('Internal server error'));

          await this.retry(fn);
        }

        async down() {
          // noop
        }
      }

      const timeoutMock = jest
        .spyOn(global, 'setTimeout')
        .mockImplementation((fn) => fn() as unknown as NodeJS.Timeout);

      const migration = new MyMigration();
      await expect(migration.up()).rejects.toThrowError(
        'Internal server error'
      );

      expect(timeoutMock).toHaveBeenCalledTimes(10);
    });
  });
});
