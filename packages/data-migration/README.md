# Nx Data Migration Plugin

This plugin provides a set of generators and executors to help you migrate data using TypeScript, with support for DynamoDB features.

## Motivation

Currently, there is no tool to perform data migrations with support for DynamoDB features. Migration is a process of moving data or schema from one state to another.

Another use case is to perform fixes on data. For example, you may want to add a new field to all your items in a table or fix a typo in a field.

## Features

### Migration engine

The data migration engine is responsible for executing the TypeScript scripts, managing the state of the data migration, and rollback if needed.

#### Migration state

The data migration state is stored in a DynamoDB table. The table is created automatically when the first migration is executed.

The table name is `migration-states-{region}-{env}` where `{env}` is the environment name. (e.g. `development`, and `production`).

> The table name can be overridden by setting the `migrationTableName` property in the `nx.json` file.

The table structure is as follows:

| Field              | Type                 | Description                                                                                                                 |
| ------------------ | -------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| namespace          | String (`HASH_KEY`)  | The namespace of the data-migration.                                                                                        |
| version            | Number (`RANGE_KEY`) | The version of the data-migration, format `${YYYYMMDD}${SEQ}` (e.g. `202301011`)                                            |
| name               | String               | The name of the data-migration.                                                                                             |
| status             | String               | The status of the data-migration. (`RUNNING`, `SUCCESS`, `ERROR`, `ROLLBACK_RUNNING`, `ROLLBACK_SUCCESS`, `ROLLBACK_ERROR`) |
| description        | String               | The description of the data-migration.                                                                                      |
| startDate          | Date                 | When the data-migration process started                                                                                     |
| endDate            | Date                 | When the data-migration process finished                                                                                    |
| rollbackStartDate  | Date                 | When the rollback process started                                                                                           |
| rollbackEndDate    | Date                 | When the rollback process finished                                                                                          |
| data-migrationPath | String               | Migration string path (relative path)                                                                                       |
| errorMessage       | String               | Error message                                                                                                               |

#### Migration Lifecycle

There are 2 phases in the migration lifecycle:

##### before:deploy

This phase is meant to be used to perform any migration that needs to be done before the deployment of the application. The lifecycle is defined in the migration script.

##### after:deploy

This phase is meant to be used to perform any migration that needs to be done after the deployment of the application. The lifecycle is defined in the migration script.

#### Migration Condition

The data migration condition is used to determine if the migration should be executed or not. The condition is defined in the migration script.

#### Migration baseline

Over the lifetime of a project, many DynamoDB tables may be created and destroyed across many migrations which leaves behind a lengthy history of migrations that need to be applied in order to bring a new environment up to speed.

Instead, you might wish to add a single, cumulative migration that represents the state of your database after all of those migrations have been applied without disrupting existing environments.

If the namespace already exists in the migration state table all baseline migrations will be skipped.

Example:

You have the following migrations:

- `202301011` - Create table `users`
- `202301012` - Add GSI `email` to table `users`
- `202301013` - Add GSI `phone` to table `users`
- `202301014` - Baseline `users` table with `email`, and `phone` GSIs.
- `202301015` - Parse `users` table `name` property to `firstName` and `lastName`.

When the migration engine identifies no migration state for the namespace `users` it will execute the baseline migration instead of the other 3 migrations and then execute the next `202301016` migration.

When the migration engine identifies a migration state for the namespace `users` it will skip the baseline migration and execute the next `202301016` migration.

Baseline migrations are useful for:

- Creating a new environment from scratch.
- Avoiding the need to run all migrations in a new environment.

### Migration scripts

Migration scripts are the files located in the project's `src/migrations` folder. They are responsible for defining the logic of what should be done in the migration or what should be done in case of a rollback.

#### Migration script structure

There are 2 ways to define a migration script:

##### Generic Provider

The generic provider is a lightweight class that provides the basic functionality to perform a migration.

```typescript
import { Migration, MigrationBase, LifecycleHook } from '@nxlv/data-migration';

@Migration({
  namespace: 'my-migration-namespace',
  version: 202304051,
  name: 'my-migration-name',
  description: 'Migration description',
  lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
})
export default class extends MigrationBase {
  async condition(): Promise<boolean> {
    return process.env.ENV === 'demo';
  }

  async up(): Promise<void> {
    this.logger.info('apply migration');
  }

  async down(): Promise<void> {
    this.logger.info('rollback migration');
  }
}
```

##### DynamoDB Provider

The DynamoDB provider is a class that extends the generic provider and provides some additional functionality to perform a migration on a DynamoDB table.

```typescript
import {
  Migration,
  DynamoDBMigrationBase,
  LifecycleHook,
} from '@nxlv/data-migration';

@Migration({
  namespace: 'my-migration-namespace',
  version: 202304051,
  name: 'my-migration-name',
  description: 'Migration description',
  lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
})
export default class extends DynamoDBMigrationBase {
  async condition(): Promise<boolean> {
    return process.env.NODE_ENV === 'demo';
  }

  async up(): Promise<void> {
    this.logger.info('apply migration');
  }

  async down(): Promise<void> {
    this.logger.info('rollback migration');
  }
}
```

##### Migration Decorator

The migration decorator is used to define the metadata of the migration script.

| Property      | Type                | Description                                                                    | Required | Default Value                 |
| ------------- | ------------------- | ------------------------------------------------------------------------------ | -------- | ----------------------------- |
| namespace     | string              | The namespace of the migration.                                                | `true`   | N/A                           |
| version       | number              | The version of the migration.                                                  | `true`   | N/A                           |
| name          | string              | The name of the migration.                                                     | `true`   | N/A                           |
| description   | string              | The description of the migration.                                              | `false`  | N/A                           |
| lifecycleHook | string              | The lifecycle of the migration.                                                | `false`  | `LifecycleHook.BEFORE_DEPLOY` |
| condition     | function or boolean | Used by the migration engine to decide if the migration can be executed or not | `false`  | `true`                        |
| parentVersion | number              | The version of the parent migration. normally used at `after:deploy` lifecycle | `false`  | N/A                           |

##### Up and Down methods

The `up` method is used to define the logic of the migration. The `down` method is used to define the logic of the rollback.

##### Logger

The logger is available in the migration script. It is used to log information, warning, and error messages.

Usage:

```typescript
this.logger.info('info message');
```

#### Generate migration script

There are 2 ways to generate a migration script:

##### Using the CLI

```bash
npx nx g @nxlv/data-migration:migration
```

When this command is executed, you will be prompted to enter the following information:

1. The `--project` option, prompts: `What is the project you want to add to the migration?`
2. The `--name` option, prompts: `What is the migration name? (e.g. fix-rates)`
3. The `--namespace` option, prompts: `What is the migration namespace? (e.g. users)`
4. The `--description` option, prompts: `What is the migration description? (e.g. Fix rates for users)`
5. The `--migrationProvider` option, prompts: `What is the migration provider?`
6. The `--lifecycleHook` option, prompts: `What is the lifecycle hook to run the migration?`
7. The `--parentVersion` option, prompts: `What is the parent version of the migration, only applicable for after:deploy migrations?`
8. The `--addStream` option, prompts: `Do you want to add a stream to the migration, only available for dynamodb migrations?`
9. The `--baseline` option, prompts: `Do you want to flag this migration as baseline?`

You can also pass the options directly to the command:

```bash
npx nx g @nxlv/data-migration:migration \
  --project=my-project \
  --name=my-migration-name \
  --namespace=my-migration-namespace \
  --description="My migration description" \
  --migrationProvider=standard \
  --lifecycleHook=before:deploy \
  --parentVersion=202304051 \
  --addStream=true
  --baseline=true
```

You can also customize the migration script path by using the `--migrationsDir` option.

##### Using the Nx Console

Nx Console provides a VSCode UI to interact with the Nx CLI. You can use it to generate a migration script.

#### Execute migration script

To execute a migration script, you need to run the following command:

```bash
npx nx run my-project:migrate --env {environment}
```

The `--env` option is used to specify the environment where the migration should be executed (e.g. `development`, `production`).

When this command is executed, the migration engine will check if there are any pending migrations to be executed. If there are any, the migration engine will execute them.

By default the `--lifecycleHook` option is set to `before:deploy`. You can change this option by using the `--lifecycleHook` option.

```bash
npx nx run my-project:migrate --env {environment} --lifecycleHook=after:deploy
```

You can also increase the log level by using the `--logLevel` option.

```bash
npx nx run my-project:migrate --env {environment} --logLevel=debug
```

#### Rollback migration script

To rollback a migration script, you need to run the following command:

```bash
npx nx run my-project:migrate-rollback --env {environment} --from {namespace}:{version}
```

The `--env` option is used to specify the environment where the migration should be executed (e.g. `development`, `production`).

The `--from` option is used to specify the migration version from which the rollback should start.

When this command is executed, the migration engine will check if there are any pending migrations to be rollbacked. If there are any, the migration engine will roll back them.

By default the `--lifecycleHook` option is set to `before:deploy`. You can change this option by using the `--lifecycleHook` option.

```bash
npx nx run my-project:migrate-rollback --env {environment} --lifecycleHook=after:deploy --from {namespace}:{version}
```

##### Example

You have 3 migrations:

- `my-migration-namespace:202304051`
- `my-migration-namespace:202304052`
- `my-migration-namespace:202304053`

If you want to rollback the migration `202304053`, you need to run the following command:

```bash
npx nx run my-project:migrate-rollback --env {environment} --from my-migration-namespace:202304053
```

This command will roll back only the migration `202304053`.

If you want to rollback the migration `202304052`, you need to run the following command:

```bash
npx nx run my-project:migrate-rollback --env {environment} --from my-migration-namespace:202304052
```

This command will roll back the migrations `202304052` and `202304053`.

#### DynamoDB Realtime Migration

There are some cases where you need to apply breaking changes to a DynamoDB table, in this case, the data needs to be migrated to a new table before deploying the new version of the application, however, the application can generate new data while the migration is running, this is where the realtime migration comes in.

The real-time migration is a migration that enables a DynamoDB stream to the source table and attaches a Lambda function to the stream, the Lambda function will be responsible for migrating the new data from the source table to the destination table.

The lambda function is generated by the migration engine using the `stream.ts` TypeScript file located in the migration folder with the same name as the base migration script.

##### Example

Version 1 creates a table called `my-table-v1`

```typescript
import { MyTableModel } from '../somewhere';
import {
  Migration,
  DynamoDBMigrationBase,
  LifecycleHook,
} from '@nxlv/data-migration';
import { chunks } from '@nxlv/util';

@Migration({
  namespace: 'teststream',
  version: 202303311,
  name: 'create-v1-table',
  description: 'Create the v1 table',
  lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
})
export default class extends DynamoDBMigrationBase {
  async up(): Promise<void> {
    await this.createTable({
      TableName: 'my-table-v1',
      KeySchema: [
        { AttributeName: 'clientId', KeyType: 'HASH' },
        { AttributeName: 'id', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'clientId', AttributeType: 'S' },
        { AttributeName: 'id', AttributeType: 'S' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    });

    this.logger.info('Creating 100 records');
    for (const chunk of chunks(Array.from(Array(100).keys()), 25)) {
      await MyTableModel.batchPut(
        chunk.map((i) => ({
          clientId: 'test',
          id: `id-${i}`,
          name: `name-${i}`,
        }))
      );
    }

    this.logger.info('Done');
  }

  async down(): Promise<void> {
    await this.deleteTable('my-table-v1', true);
  }
}
```

> This example uses [dynamoose](https://dynamoosejs.com/getting_started/Introduction) to interact with DynamoDB

Version 2 creates a table called `my-table-v2`

```typescript
import {
  Migration,
  DynamoDBMigrationBase,
  LifecycleHook,
} from '@nxlv/data-migration';

@Migration({
  namespace: 'teststream',
  version: 202303312,
  name: 'create-v2-table',
  description: 'Create the v2 table',
  lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
})
export default class extends DynamoDBMigrationBase {
  async up(): Promise<void> {
    await this.createTable({
      TableName: 'my-table-v2',
      KeySchema: [
        { AttributeName: 'clientId', KeyType: 'HASH' },
        { AttributeName: 'id', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'clientId', AttributeType: 'S' },
        { AttributeName: 'id', AttributeType: 'S' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    });
  }

  async down(): Promise<void> {
    await this.deleteTable('my-table-v2', true);
  }
}
```

Version 3 creates a real-time migration from `my-table-v1` to `my-table-v2`

```typescript
import { MyTableModel, MyTableV2Model } from '../somewhere';
import {
  Migration,
  DynamoDBMigrationBase,
  LifecycleHook,
  chunks,
} from '@nxlv/data-migration';

@Migration({
  namespace: 'teststream',
  version: 202303313,
  name: 'migrate-data',
  description: 'Testing real-time data migration',
  lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
})
export default class extends DynamoDBMigrationBase {
  async up(): Promise<void> {
    await this.enableStream('my-table-v1');

    const items = await MyTableModel.scan().exec();
    for (const chunk of chunks(items, 25)) {
      await MyTableV2Model.batchPut(
        chunk.map((item) => ({ ...item, age: 20 }))
      );
    }
  }

  async down(): Promise<void> {
    await this.removeStream('my-table-v1', this.name, this.version);
  }
}
```

A stream script is created for the migration `202303313` called `202303313-migrate-data.stream.ts` with the following content:

```typescript
import { DynamoDBStreamHandler } from 'aws-lambda';

export const handler: DynamoDBStreamHandler = async (event) => {
  console.debug('Event', JSON.stringify(event));

  // IMPLEMENT YOUR LOGIC HERE

  console.log('Parsed records', event.Records.length);
};
```

And you can implement your logic to migrate the data from `my-table-v1` to `my-table-v2` in the `handler` function.

Version 4 removes the real-time migration

```typescript
import {
  Migration,
  DynamoDBMigrationBase,
  LifecycleHook,
} from '@nxlv/data-migration';

@Migration({
  namespace: 'teststream',
  version: 202304031,
  name: 'remove-v1-stream',
  description: 'Remove Stream from v1 table',
  lifecycleHook: LifecycleHook.AFTER_DEPLOY,
  parentVersion: 202303313,
})
export default class extends DynamoDBMigrationBase {
  async up(): Promise<void> {
    await this.removeStream('my-table-v1', 'migrate-data', this.parentVersion);
  }

  async down(): Promise<void> {
    this.logger.warn('To be implemented');
  }
}
```

This migration is configured to run after the application deployment.

Version 5 removes the v1 table

```typescript
import {
  Migration,
  DynamoDBMigrationBase,
  LifecycleHook,
} from '@nxlv/data-migration';

@Migration({
  namespace: 'teststream',
  version: 202304032,
  name: 'remove-v1-table',
  description: 'Remove v1 Table',
  lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
})
export default class extends DynamoDBMigrationBase {
  async up(): Promise<void> {
    await this.createBackup('my-table-v1');
    await this.deleteTable('my-table-v1');
  }

  async down(): Promise<void> {
    await this.restoreBackup('my-table-v1');
  }
}
```

#### Remote Migrations

Remote migrations are designed to be executed in a remote environment, (currently, only supports AWS ECS). The idea is to have a container that runs the migrations and then shuts down. This is useful for CI/CD pipelines when you need to access resources that are not available in the CI/CD environment, such as network resources, databases, etc.

The data migration engine is responsible for creating the container, running the migration, capturing the logs, and shutting down the container when the migration is finished.

To run a remote migration, you need to create a migration script with the following config.

```typescript
import {
  Migration,
  DynamoDBMigrationBase,
  LifecycleHook,
} from '@nxlv/data-migration';

@Migration({
  namespace: 'remote-example',
  version: 202305151,
  name: 'remote-example',
  description: 'Migrate data remotely',
  lifecycleHook: LifecycleHook.BEFORE_DEPLOY,
  remote: {
    type: 'ecs',
    config: {
      cluster: {
        type: 'ssm',
        value: '/my-project/ecs/cluster',
      },
      cpu: 512,
      memory: 1024,
      networkMode: 'awsvpc',
      executionRoleArn: {
        type: 'ssm',
        value: '/my-project/ecs/execution-role',
      },
      securityGroupId: {
        type: 'ssm',
        value: '/my-project/ecs/security-group',
      },
      subnetIds: {
        type: 'ssm',
        value: '/my-project/ecs/subnets',
      },
      taskRoleArn: {
        type: 'ssm',
        value: '/my-project/ecs/task-role',
      },
    },
  },
})
export default class extends DynamoDBMigrationBase {
  async up(): Promise<void> {
    // IMPLEMENT YOUR LOGIC HERE
  }

  async down(): Promise<void> {
    // IMPLEMENT YOUR LOGIC HERE
  }
}
```

The `remote` property is an object that contains the configuration to run the migration remotely. Currently, only `ecs` is supported as a remote type.

For the `ecs` type, the following configuration is required:

- `cluster`: The cluster name where the container will be executed. It can be a SSM parameter or a value:
  - `type`: The type of the value. It can be `ssm` or `plain`.
  - `value`: The value of the property. If the type is `ssm`, the value is the SSM parameter name.
- `cpu`: The number of CPU units to reserve for the container.
- `memory`: The amount of memory (in MiB) to present to the container.
- `networkMode`: The Docker networking mode to use for the containers in the task. The valid values are `none`, `bridge`, `awsvpc`, and `host`.
- `executionRoleArn`: The Amazon Resource Name (ARN) of the task execution role that grants the Amazon ECS container agent permission to make AWS API calls on your behalf.
  - `type`: The type of the value. It can be `ssm` or `plain`.
  - `value`: The value of the property. If the type is `ssm`, the value is the SSM parameter name.
- `securityGroupId`: The security group ID to associate with the task or service.
  - `type`: The type of the value. It can be `ssm` or `plain`.
  - `value`: The value of the property. If the type is `ssm`, the value is the SSM parameter name.
- `subnetIds`: The IDs of the subnets associated with the task or service.
  - `type`: The type of the value. It can be `ssm` or `plain`.
  - `value`: The value of the property. If the type is `ssm`, the value is the SSM parameter name.
- `taskRoleArn`: The Amazon Resource Name (ARN) of the task role that grants containers in the task permission to call AWS APIs on your behalf.
  - `type`: The type of the value. It can be `ssm` or `plain`.
  - `value`: The value of the property. If the type is `ssm`, the value is the SSM parameter name.

> **Note:** The `remote` property is optional. If it is not present, the migration will be executed locally.
> **Note:** The `remote` property is not supported in the rollback executor yet.
> **Note:** The migration engine will create an ECR repository with the name `migrations` if it does not exist, and it will push the migration image to that repository, so make sure that the IAM role that is executing the migration has the permissions to create ECR repositories and push images to ECR.
> **Note:** Make sure that the IAM role that is executing the migration has permission to access the migration state DynamoDB table.

##### Execution Role Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "*"
    }
  ]
}
```

or attach the `arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy` policy to the execution role.

##### Task Role Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DynamoDB",
      "Effect": "Allow",
      "Action": [
        "dynamodb:UpdateItem",
        "dynamodb:Scan",
        "dynamodb:Query",
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:DescribeTable",
        "dynamodb:BatchWriteItem",
        "dynamodb:BatchGetItem"
      ],
      "Resource": "*"
    }
  ]
}
```

And also, make sure that the task role has permission to access the resources that the migration needs to access.

#### Examples

[Here](https://github.com/lucasvieirasilva/nx-plugins/tree/main/packages/data-migration-example/src/migrations/) are some examples of how to use the data migration engine.
