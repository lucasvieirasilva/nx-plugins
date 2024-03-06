import { MigrationBase } from '../migration';
import esbuild from 'esbuild';
import {
  DynamoDBClient,
  TableDescription,
  RestoreTableToPointInTimeInput,
  RestoreTableToPointInTimeCommand,
  waitUntilTableExists,
  ListBackupsCommand,
  RestoreTableFromBackupCommand,
  CreateBackupCommand,
  DescribeBackupCommand,
  UpdateTableInput,
  UpdateTableCommand,
  CreateTableInput,
  CreateTableCommand,
  DeleteTableCommand,
  waitUntilTableNotExists,
  DescribeTableCommand,
  ListTagsOfResourceCommand,
  TagResourceCommand,
  Tag,
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
  Runtime,
} from '@aws-sdk/client-lambda';
import path from 'path';
import {
  IAMClient,
  GetRoleCommand,
  CreateRoleCommand,
  waitUntilRoleExists,
  PutRolePolicyCommand,
  ListRolePoliciesCommand,
  DeleteRolePolicyCommand,
  DeleteRoleCommand,
} from '@aws-sdk/client-iam';
import fs from 'fs';
import archiver from 'archiver';
import _ from 'lodash';
import {
  SSMClient,
  DeleteParameterCommand,
  PutParameterCommand,
} from '@aws-sdk/client-ssm';
import { toCapitalizedCamelCase } from '@nxlv/util';

const MAX_WAIT_TIME = 60 * 60 * 2; // 2 hours

type StreamLambdaOptions = {
  iamRoleArn?: string;
  memorySize?: number;
  timeout?: number;
  runtime?: Runtime;
  envVars?: { [key: string]: string };
  iamPolicyStatements?: Record<string, unknown>[];
};

export abstract class DynamoDBMigrationBase extends MigrationBase {
  public client: DynamoDBClient;
  public region: string;

  constructor() {
    super();
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.client = new DynamoDBClient({ region: this.region });
  }

  protected async restoreTablePointInTime(
    params: RestoreTableToPointInTimeInput,
  ) {
    await this.client.send(new RestoreTableToPointInTimeCommand(params));

    await waitUntilTableExists(
      {
        client: this.client,
        maxWaitTime: MAX_WAIT_TIME,
      },
      {
        TableName: params.TargetTableName,
      },
    );
  }

  protected async restoreBackup(tableName: string) {
    const backupName = `${this.namespace}-${this.name}-${this.version}-migration-backup`;

    this.logger.info(`Restoring backup ${backupName}`);
    const backups = await this.client.send(
      new ListBackupsCommand({
        TableName: tableName,
        BackupType: 'ALL',
      }),
    );

    const backup = backups.BackupSummaries.find(
      (backup) => backup.BackupName === backupName,
    );

    if (!backup) {
      throw new Error(`Backup ${backupName} not found`);
    }

    await this.client.send(
      new RestoreTableFromBackupCommand({
        BackupArn: backup.BackupArn,
        TargetTableName: tableName,
      }),
    );

    this.logger.info(`Backup ${backupName} restored`);

    this.logger.info(`Waiting for backup ${backupName} to be restored`);
    await waitUntilTableExists(
      {
        client: this.client,
        maxWaitTime: MAX_WAIT_TIME,
      },
      {
        TableName: tableName,
      },
    );
  }

  protected async createBackup(tableName: string) {
    const backupName = `${this.namespace}-${this.name}-${this.version}-migration-backup`;
    this.logger.info(`Creating backup ${backupName}`);
    const { BackupDetails } = await this.client.send(
      new CreateBackupCommand({
        BackupName: backupName,
        TableName: tableName,
      }),
    );
    this.logger.info(`Backup ${backupName} created`);

    this.logger.info(`Waiting for backup ${backupName} to be created`);
    let backupStatus = BackupDetails.BackupStatus;
    const limitRetries = 360; // 1 hour
    let retries = 0;

    do {
      await this.sleep(10);

      this.logger.info(`Backup ${backupName} status: ${backupStatus}`);
      const {
        BackupDescription: {
          BackupDetails: { BackupStatus },
        },
      } = await this.client.send(
        new DescribeBackupCommand({
          BackupArn: BackupDetails.BackupArn,
        }),
      );

      backupStatus = BackupStatus;
      retries++;

      if (backupStatus === 'DELETED') {
        throw new Error(`Backup ${backupName} was deleted externally`);
      }

      if (retries === limitRetries) {
        throw new Error(
          `Timeout waiting for backup ${backupName} to be created`,
        );
      }
    } while (backupStatus !== 'AVAILABLE');

    this.logger.info(`Backup ${backupName} created`);
  }

  protected async updateTable(
    input: UpdateTableInput,
    storeStreamArnToSSM = true,
    wait = true,
  ): Promise<void> {
    this.logger.info(`Updating table ${input.TableName}`);

    await this.client.send(new UpdateTableCommand(input));

    this.logger.info(`Waiting for table ${input.TableName} to be updated`);
    if (wait) {
      await waitUntilTableExists(
        {
          client: this.client,
          maxWaitTime: MAX_WAIT_TIME,
        },
        {
          TableName: input.TableName,
        },
      );
    }

    this.logger.info(`Table ${input.TableName} updated`);

    if (storeStreamArnToSSM && input.StreamSpecification?.StreamEnabled) {
      this.logger.info('DynamoDB Stream Enabled, storing ARN to SSM');
      await this.storeStreamArnToSSM(input.TableName);
    }
  }

  protected async createTable(
    input: CreateTableInput,
    storeStreamArnToSSM = true,
  ): Promise<void> {
    this.logger.info(`Creating table ${input.TableName}`);

    if (!input.Tags) {
      input.Tags = [];
    }
    input.Tags.push(...this.getTags());

    await this.client.send(new CreateTableCommand(input));

    this.logger.info(`Waiting for table ${input.TableName} to be created`);
    await waitUntilTableExists(
      {
        client: this.client,
        maxWaitTime: MAX_WAIT_TIME,
      },
      {
        TableName: input.TableName,
      },
    );

    this.logger.info(`Table ${input.TableName} created`);

    if (storeStreamArnToSSM && input.StreamSpecification?.StreamEnabled) {
      this.logger.info('DynamoDB Stream Enabled, storing ARN to SSM');
      await this.storeStreamArnToSSM(input.TableName);
    }
  }

  protected async deleteStreamArnFromSSM(tableName: string) {
    const streamArn = await this.getStreamArn(tableName);
    const nodeEnv = process.env.ENV || 'development';
    const environmentlessTableName = tableName.replace(`${nodeEnv}_`, '');

    const ssmClient = new SSMClient({ region: this.region });
    const ssmName = toCapitalizedCamelCase(`${environmentlessTableName}Stream`);
    this.logger.info(`Deleting SSM ${ssmName}`);
    await ssmClient.send(new DeleteParameterCommand({ Name: ssmName }));

    this.logger.info(`SSM ${streamArn} deleted`);
  }

  protected async storeStreamArnToSSM(tableName: string) {
    const streamArn = await this.getStreamArn(tableName);
    const nodeEnv = process.env.ENV || 'development';
    const environmentlessTableName = tableName.replace(`${nodeEnv}_`, '');

    const ssmClient = new SSMClient({ region: this.region });
    const ssmName = toCapitalizedCamelCase(`${environmentlessTableName}Stream`);
    this.logger.info(`Storing stream ARN ${streamArn} to SSM ${ssmName}`);
    await ssmClient.send(
      new PutParameterCommand({
        Name: ssmName,
        Value: streamArn,
        Type: 'String',
        Overwrite: true,
      }),
    );

    this.logger.info(`Stream ARN ${streamArn} stored to SSM`);
  }

  protected async deleteTable(
    tableName: string,
    forceDelete = false,
  ): Promise<void> {
    const table = await this.describeTable(tableName);
    if (table === null) {
      this.logger.info(`Table ${tableName} does not exist`);
      return;
    }

    if (
      forceDelete === false &&
      (await this.tableCreatedByMigration(table)) === false
    ) {
      this.logger.info(`Table ${tableName} was not created by this migration`);
      return;
    }

    this.logger.info(`Deleting table ${tableName}`);
    await this.client.send(new DeleteTableCommand({ TableName: tableName }));

    this.logger.info(`Waiting for table ${tableName} to be deleted`);
    await waitUntilTableNotExists(
      {
        client: this.client,
        maxWaitTime: MAX_WAIT_TIME,
      },
      {
        TableName: tableName,
      },
    );
  }

  protected async enableStream(
    sourceTableName: string,
    options: StreamLambdaOptions = {},
  ) {
    const defaults: StreamLambdaOptions = {
      memorySize: 256,
      timeout: 60,
      envVars: {},
      runtime: 'nodejs18.x',
      iamPolicyStatements: [],
    };

    const resolvedOptions = _.merge(defaults, options);

    this.logger.debug(`Describing table ${sourceTableName}`);
    const { Table: sourceTable } = await this.client.send(
      new DescribeTableCommand({
        TableName: sourceTableName,
      }),
    );

    await this.enableDynamoDBStreams(sourceTable);

    const streamArn = await this.getStreamArn(sourceTableName);

    const stagingFolder = path.join(
      'dist',
      path.relative(process.cwd(), this.path).replace('.ts', ''),
      '.staging-stream-lambda',
    );

    const distFolder = path.join(
      'dist',
      path.relative(process.cwd(), this.path).replace('.ts', ''),
      'stream-lambda',
    );
    const functionName = this.getStreamFunctionName();

    const zipPath = await this.compileLambdaFunction(
      functionName,
      stagingFolder,
      distFolder,
    );

    if (!resolvedOptions.iamRoleArn) {
      resolvedOptions.iamRoleArn = await this.createLambdaStreamIamRole(
        streamArn,
        resolvedOptions.iamPolicyStatements,
      );
    }

    await this.createStreamLambdaFunction(
      functionName,
      zipPath,
      streamArn,
      resolvedOptions,
    );

    this.logger.info(
      `Migration ${this.namespace}/${this.name}/${this.version} stream lambda created`,
    );
  }

  protected async removeStream(
    sourceTableName: string,
    name: string,
    version: number,
    deleteIamRole = true,
  ) {
    const sourceTable = await this.client.send(
      new DescribeTableCommand({
        TableName: sourceTableName,
      }),
    );

    const { Tags } = await this.client.send(
      new ListTagsOfResourceCommand({
        ResourceArn: sourceTable.Table.TableArn,
      }),
    );

    const shouldDisableStream =
      !_.isNil(
        Tags.find(
          (tag) =>
            tag.Key === 'migration:stream-enabled-by' &&
            tag.Value === 'migration',
        ),
      ) && sourceTable.Table.StreamSpecification?.StreamEnabled === true;

    if (shouldDisableStream) {
      this.logger.info(
        `Disabling stream for ${sourceTableName} as it was enabled by migration`,
      );
      await this.client.send(
        new UpdateTableCommand({
          TableName: sourceTableName,
          StreamSpecification: {
            StreamEnabled: false,
          },
        }),
      );
    }

    const functionName = this.getStreamFunctionName(name, version);
    await this.deleteFunction(functionName);
    if (deleteIamRole) {
      const roleName = this.getStreamIamRoleName(name, version);
      await this.deleteIamRole(roleName);
    }

    this.logger.info(
      `Migration ${this.namespace}/${name}/${version} stream lambda removed`,
    );
  }

  protected async iamRoleExists(roleName: string): Promise<boolean> {
    const iamClient = new IAMClient({ region: this.region });

    try {
      await iamClient.send(
        new GetRoleCommand({
          RoleName: roleName,
        }),
      );
    } catch (e) {
      if (e.name === 'NoSuchEntityException') {
        return false;
      }
      throw e;
    }

    return true;
  }

  protected async functionExists(functionName: string): Promise<boolean> {
    const lambdaClient = new LambdaClient({ region: this.region });

    try {
      await lambdaClient.send(
        new GetFunctionCommand({
          FunctionName: functionName,
        }),
      );
    } catch (e) {
      if (e.name === 'ResourceNotFoundException') {
        return false;
      }
      throw e;
    }

    return true;
  }

  protected async describeTable(
    tableName: string,
  ): Promise<TableDescription | null> {
    try {
      const { Table } = await this.client.send(
        new DescribeTableCommand({
          TableName: tableName,
        }),
      );

      return Table;
    } catch (e) {
      if (e.name === 'ResourceNotFoundException') {
        return null;
      }
      throw e;
    }
  }

  protected retry<T>(
    fn: () => Promise<T>,
    startDelay = 0,
    delay = 1000,
    retries = 10,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const retry = () => {
        fn()
          .then(resolve)
          .catch((e) => {
            if (retries > 0) {
              retries--;
              setTimeout(retry, delay);
            } else {
              reject(e);
            }
          });
      };

      if (startDelay > 0) {
        setTimeout(retry, startDelay);
      } else {
        retry();
      }
    });
  }

  private async createStreamLambdaFunction(
    functionName: string,
    zipPath: string,
    streamArn: string,
    lambdaOptions: StreamLambdaOptions,
  ) {
    this.logger.info(`Creating lambda function ${functionName}`);

    await this.deleteFunction(functionName);

    const lambdaClient = new LambdaClient({ region: this.region });
    await this.retry(async () => {
      await lambdaClient.send(
        new CreateFunctionCommand({
          FunctionName: functionName,
          Runtime: lambdaOptions.runtime,
          Role: lambdaOptions.iamRoleArn,
          Handler: 'handler.handler',
          Code: {
            ZipFile: fs.readFileSync(zipPath),
          },
          Description: `Lambda function for migration ${this.namespace}/${this.name}/${this.version} stream`,
          Timeout: lambdaOptions.timeout,
          MemorySize: lambdaOptions.memorySize,
          Tags: this.getLambdaTags(),
          Environment: {
            Variables: {
              ENV: process.env.ENV,
              ...lambdaOptions.envVars,
            },
          },
        }),
      );
    }, 5000);

    this.logger.info(`Creating stream event source for ${functionName}`);

    await lambdaClient.send(
      new CreateEventSourceMappingCommand({
        FunctionName: functionName,
        EventSourceArn: streamArn,
        StartingPosition: 'TRIM_HORIZON',
      }),
    );
  }

  private async createLambdaStreamIamRole(
    streamArn: string,
    additionalStatments: Record<string, unknown>[],
  ) {
    const iamClient = new IAMClient({ region: this.region });
    const roleName = this.getStreamIamRoleName();

    await this.deleteIamRole(roleName);

    this.logger.info(`Creating IAM role ${roleName}`);

    const iamRole = await iamClient.send(
      new CreateRoleCommand({
        AssumeRolePolicyDocument: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: {
                Service: 'lambda.amazonaws.com',
              },
              Action: 'sts:AssumeRole',
            },
          ],
        }),
        RoleName: roleName,
        Path: '/',
        Tags: this.getTags(),
        Description: `IAM role for migration ${this.namespace}/${this.name}/${this.version} stream lambda`,
      }),
    );

    await waitUntilRoleExists(
      {
        client: iamClient,
        maxWaitTime: MAX_WAIT_TIME,
      },
      {
        RoleName: roleName,
      },
    );

    const roleArn = iamRole.Role.Arn;

    this.logger.info(`Attaching policy to role ${roleName}`);
    await iamClient.send(
      new PutRolePolicyCommand({
        RoleName: roleName,
        PolicyName: 'migration-stream-lambda',
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
              Resource: [streamArn],
            },
            {
              Effect: 'Allow',
              Action: [
                'dynamodb:BatchGet*',
                'dynamodb:Get*',
                'dynamodb:Query',
                'dynamodb:Scan',
                'dynamodb:Describe*',
                'dynamodb:DeleteItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:BatchWrite*',
              ],
              Resource: ['*'],
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
            ...additionalStatments,
          ],
        }),
      }),
    );
    return roleArn;
  }

  private async getStreamArn(sourceTableName: string) {
    const streamsClient = new DynamoDBStreamsClient({ region: this.region });
    this.logger.debug(`Listing streams for table ${sourceTableName}`);
    const streams = await streamsClient.send(
      new ListStreamsCommand({
        TableName: sourceTableName,
      }),
    );

    if (!streams.Streams?.length) {
      throw new Error(`No streams found for table ${sourceTableName}`);
    }

    return streams.Streams[0].StreamArn;
  }

  private async enableDynamoDBStreams(sourceTable: TableDescription) {
    const sourceTableName = sourceTable.TableName;

    let streamEnabledBy = 'external';

    if (
      !sourceTable.StreamSpecification?.StreamEnabled ||
      (sourceTable.StreamSpecification.StreamEnabled &&
        sourceTable.StreamSpecification.StreamViewType !== 'NEW_AND_OLD_IMAGES')
    ) {
      this.logger.info(`Enabling streams on table ${sourceTableName}`);
      await this.client.send(
        new UpdateTableCommand({
          TableName: sourceTableName,
          StreamSpecification: {
            StreamEnabled: true,
            StreamViewType: 'NEW_AND_OLD_IMAGES',
          },
        }),
      );
      streamEnabledBy = 'migration';

      await waitUntilTableExists(
        {
          client: this.client,
          maxWaitTime: MAX_WAIT_TIME,
        },
        {
          TableName: sourceTableName,
        },
      );
    }

    this.logger.debug(`Adding tags to table ${sourceTableName}`);
    const newTags = [
      ...(
        await this.client.send(
          new ListTagsOfResourceCommand({
            ResourceArn: sourceTable.TableArn,
          }),
        )
      ).Tags,
      ...this.getTags(),
      {
        Key: 'migration:stream-enabled-by',
        Value: streamEnabledBy,
      },
    ];

    await this.client.send(
      new TagResourceCommand({
        ResourceArn: sourceTable.TableArn,
        Tags: _.uniqBy(newTags, 'Key'),
      }),
    );
  }

  private async compileLambdaFunction(
    functionName: string,
    stagingFolder: string,
    distFolder: string,
  ): Promise<string> {
    const tranformPath = path.join(
      path.dirname(this.path),
      path.basename(this.path, '.ts') + '.stream.ts',
    );

    this.logger.debug(`Compiling ${tranformPath} migration using esbuild`);
    const buildStart = Date.now();
    await esbuild.build({
      format: 'cjs',
      bundle: true,
      minify: false,
      sourcemap: false,
      target: ['node18'],
      entryPoints: [tranformPath],
      outfile: path.join(stagingFolder, 'handler.js'),
      platform: 'node',
      external: ['aws-sdk', '@aws-sdk/*'],
    });
    this.logger.debug(
      `File ${tranformPath} compiled in ${Date.now() - buildStart}ms`,
    );

    this.logger.info(`Zipping lambda function ${functionName}`);
    this.logger.debug(`Staging folder: ${stagingFolder}`);
    this.logger.debug(`Dist folder: ${distFolder}`);

    const zipPath = path.join(
      path.resolve(distFolder, '..'),
      `${functionName}.zip`,
    );
    this.logger.debug(`Zip path: ${zipPath}`);
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }

    await this.zipDirectory(stagingFolder, zipPath);

    this.logger.info(`Lambda function ${functionName} zipped`);

    return zipPath;
  }

  private async deleteFunction(functionName: string) {
    const lambdaClient = new LambdaClient({ region: this.region });

    this.logger.debug(`Checking if function ${functionName} exists`);
    if (await this.functionExists(functionName)) {
      const events = await lambdaClient.send(
        new ListEventSourceMappingsCommand({
          FunctionName: functionName,
        }),
      );

      for (const event of events.EventSourceMappings) {
        this.logger.info(`Removing event source mapping ${event.UUID}`);
        await lambdaClient.send(
          new DeleteEventSourceMappingCommand({
            UUID: event.UUID,
          }),
        );
      }

      this.logger.info(`Removing lambda function ${functionName}`);
      await lambdaClient.send(
        new DeleteFunctionCommand({ FunctionName: functionName }),
      );
    }
  }

  private async deleteIamRole(roleName: string) {
    const iamClient = new IAMClient({ region: this.region });
    this.logger.debug(`Checking if IAM role ${roleName} exists`);
    if (await this.iamRoleExists(roleName)) {
      const policies = await iamClient.send(
        new ListRolePoliciesCommand({
          RoleName: roleName,
        }),
      );

      for (const policy of policies.PolicyNames) {
        this.logger.info(`Removing IAM policy ${policy} from role ${roleName}`);
        await iamClient.send(
          new DeleteRolePolicyCommand({
            RoleName: roleName,
            PolicyName: policy,
          }),
        );
      }

      this.logger.info(`Removing IAM role ${roleName}`);
      await iamClient.send(new DeleteRoleCommand({ RoleName: roleName }));
    }
  }

  private getStreamIamRoleName(name?: string, version?: number) {
    return `migration-${this.namespace}-${name ?? this.name}-${
      version ?? this.version
    }-stream-role`;
  }

  private getStreamFunctionName(name?: string, version?: number) {
    return `migration-${this.namespace}-${name ?? this.name}-${
      version ?? this.version
    }-stream`;
  }

  private zipDirectory(sourceDir: string, outPath: string): Promise<void> {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const stream = fs.createWriteStream(outPath);

    return new Promise((resolve, reject) => {
      archive
        .directory(sourceDir, false)
        .on('error', (err) => reject(err))
        .pipe(stream);

      stream.on('close', () => resolve(undefined));
      archive.finalize();
    });
  }

  private async tableCreatedByMigration(
    table: TableDescription,
  ): Promise<boolean> {
    const { Tags } = await this.client.send(
      new ListTagsOfResourceCommand({
        ResourceArn: table.TableArn,
      }),
    );

    return !_.isNil(
      Tags.find(
        (tag) =>
          tag.Key === 'migration:created-by' && tag.Value === 'migration',
      ),
    );
  }

  private getLambdaTags(): Record<string, string> {
    return {
      'migration:name': this.name,
      'migration:namespace': this.namespace,
      'migration:version': this.version.toString(),
      'migration:path': this.path,
    };
  }

  private getTags(): Tag[] {
    return [
      {
        Key: 'migration:name',
        Value: this.name,
      },
      {
        Key: 'migration:namespace',
        Value: this.namespace,
      },
      {
        Key: 'migration:version',
        Value: this.version.toString(),
      },
      {
        Key: 'migration:path',
        Value: this.path,
      },
      {
        Key: 'migration:created-by',
        Value: 'migration',
      },
    ];
  }
}
