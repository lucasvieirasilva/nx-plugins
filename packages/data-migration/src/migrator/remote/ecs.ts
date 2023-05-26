import esbuild from 'esbuild';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import {
  ECRClient,
  DescribeRepositoriesCommand,
  CreateRepositoryCommand,
} from '@aws-sdk/client-ecr';
import {
  ECSClient,
  RegisterTaskDefinitionCommand,
  DeregisterTaskDefinitionCommand,
  DescribeTasksCommand,
  RunTaskCommand,
  Task,
} from '@aws-sdk/client-ecs';
import {
  CloudWatchLogsClient,
  DeleteLogGroupCommand,
  GetLogEventsCommand,
  CreateLogGroupCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import path from 'path';
import { MigrationBase } from '../types';
import { ManagedMigrationError } from '../error/migrator-error';
import { CLILogger } from '../logger';
import chalk from 'chalk';
import spawn from 'cross-spawn';
import { execSync } from 'child_process';
import fs from 'fs';
import { resolveConfigParam } from '../utils';

const sts = new STSClient({});
const ecr = new ECRClient({});
const cloudWatchLogs = new CloudWatchLogsClient({});
const ecs = new ECSClient({});

export class EcsRemoteRunner {
  constructor(
    private readonly logger: CLILogger,
    private readonly migration: MigrationBase
  ) {}

  public async run() {
    let taskDefinitionArn;
    let logGroupName;

    try {
      this.logger.info(
        `Migration ${chalk.bold(
          `${this.migration.namespace}:${this.migration.name}:${this.migration.version}`
        )} is running remotely on ECS`
      );
      // running migration remotely
      // 1. Build docker image (1h)
      const { Account: accountId } = await sts.send(
        new GetCallerIdentityCommand({})
      );
      const awsRegion = process.env.AWS_REGION || 'us-east-1';
      const ecrRepositoryBase = `${accountId}.dkr.ecr.${awsRegion}.amazonaws.com`;
      const ecrRepoName = 'migrations';

      this.dockerLogin(awsRegion, 'public.ecr.aws', true);
      this.dockerLogin(awsRegion, ecrRepositoryBase, false);

      await this.createEcrIfNotExists(ecrRepoName);
      const remoteDistFolder = await this.compileRemoteWrapper();

      const ecrImageTag = this.buildAndPushImage(
        ecrRepositoryBase,
        ecrRepoName,
        remoteDistFolder
      );

      logGroupName = await this.createCloudWatchLogGroupIfNotExists();
      taskDefinitionArn = await this.createTaskDefinition(
        logGroupName,
        awsRegion,
        ecrImageTag
      );

      // 6. Run task (1h)
      const task = await this.runTask(taskDefinitionArn);
      await this.waitForTask(task, logGroupName);
    } finally {
      if (taskDefinitionArn) {
        this.logger.debug(`Deleting task definition ${taskDefinitionArn}`);
        await ecs.send(
          new DeregisterTaskDefinitionCommand({
            taskDefinition: taskDefinitionArn,
          })
        );
      }

      if (logGroupName) {
        this.logger.debug(`Deleting log group ${logGroupName}`);
        await cloudWatchLogs.send(new DeleteLogGroupCommand({ logGroupName }));
      }
    }
  }

  private async waitForTask(task: Task, logGroupName: string) {
    let taskStatus = 'RUNNING';

    this.logger.debug(`Waiting for ECS task to complete`);
    let startTime = Date.now();
    const { config } = this.migration.remote;
    do {
      const tasksDetails = await ecs.send(
        new DescribeTasksCommand({
          cluster: await resolveConfigParam(config.cluster),
          tasks: [task.taskArn],
        })
      );

      const taskDetails = tasksDetails.tasks[0];
      taskStatus = taskDetails.lastStatus;
      const taskArnElements = taskDetails.taskArn.split('/');
      const taskId = taskArnElements[taskArnElements.length - 1];

      startTime = await this.captureTaskLogs(
        taskId,
        logGroupName,
        taskDetails,
        startTime
      );

      await this.migration.sleep(10);
      this.logger.debug(`ECS task status: ${taskStatus}`);
      if (
        taskDetails.containers[0].lastStatus === 'STOPPED' &&
        taskDetails.containers[0].exitCode !== 0
      ) {
        throw new ManagedMigrationError(
          `Failed to run migration ${this.migration.namespace}:${this.migration.name}:${this.migration.version}: task exited with non-zero exit code ${taskDetails.containers[0].exitCode}`
        );
      }
    } while (
      taskStatus === 'RUNNING' ||
      taskStatus === 'PENDING' ||
      taskStatus === 'PROVISIONING'
    );
  }

  private async captureTaskLogs(
    taskId: string,
    logGroupName: string,
    taskDetails: Task,
    startTime: number
  ) {
    try {
      this.logger.debug(`Fetching ECS task logs from CloudWatch ${taskId}`);
      const { events } = await cloudWatchLogs.send(
        new GetLogEventsCommand({
          logGroupName,
          logStreamName: `ecs/${taskDetails.containers[0].name}/${taskId}`,
          startTime,
          endTime: Date.now(),
        })
      );

      for (const event of events) {
        console.log(event.message);
      }

      if (events.length > 0) {
        startTime = events[events.length - 1].timestamp + 1;
      }
    } catch (error) {
      if (error.code !== 'ResourceNotFoundException') {
        this.logger.warn(`Error fetching ECS task logs: ${error.message}`);
      }
    }
    return startTime;
  }

  private async runTask(taskDefinitionArn: string) {
    const { config } = this.migration.remote;
    this.logger.info(`Running ECS task`);
    const { tasks } = await ecs.send(
      new RunTaskCommand({
        cluster: await resolveConfigParam(config.cluster),
        taskDefinition: taskDefinitionArn,
        count: 1,
        launchType: 'FARGATE',
        startedBy: 'migration',
        networkConfiguration: {
          awsvpcConfiguration: {
            assignPublicIp: 'DISABLED',
            subnets: (await resolveConfigParam(config.subnetIds))
              .split(',')
              .map((x) => x.trim()),
            securityGroups: [await resolveConfigParam(config.securityGroupId)],
          },
        },
      })
    );

    if (tasks.length === 0) {
      throw new ManagedMigrationError(
        `Failed to run migration ${this.migration.namespace}:${this.migration.name}:${this.migration.version}: no tasks returned`
      );
    }

    return tasks[0];
  }

  private async createTaskDefinition(
    logGroupName: string,
    awsRegion: string,
    ecrImageTag: string
  ): Promise<string> {
    this.logger.debug(`Registering ECS task definition`);
    const { config } = this.migration.remote;
    const {
      taskDefinition: { taskDefinitionArn },
    } = await ecs.send(
      new RegisterTaskDefinitionCommand({
        cpu: config.cpu.toString(),
        memory: config.memory.toString(),
        family: `migration-${this.migration.namespace}-${this.migration.name}-${this.migration.version}-task`,
        executionRoleArn: await resolveConfigParam(config.executionRoleArn),
        taskRoleArn: await resolveConfigParam(config.taskRoleArn),
        networkMode: config.networkMode,
        containerDefinitions: [
          {
            image: ecrImageTag,
            name: 'migration',
            environment: [
              {
                name: 'LOG_LEVEL',
                value: this.logger.level,
              },
              {
                name: 'NODE_ENV',
                value: process.env.NODE_ENV,
              },
              {
                name: 'KMS_KEY_ID',
                value: process.env.KMS_KEY_ID,
              },
              {
                name: 'SM_ES_SECRET_ID',
                value: process.env.SM_ES_SECRET_ID,
              },
              {
                name: 'MIGRATION_FILE_NAME',
                value: 'migration.js',
              },
              {
                name: 'OPERATION',
                value: 'run',
              },
            ],
            logConfiguration: {
              logDriver: 'awslogs',
              options: {
                'awslogs-region': awsRegion,
                'awslogs-group': logGroupName,
                'awslogs-stream-prefix': 'ecs',
              },
            },
          },
        ],
        requiresCompatibilities: ['FARGATE'],
      })
    );

    return taskDefinitionArn;
  }

  private async createCloudWatchLogGroupIfNotExists() {
    const logGroupName = `/ecs/${this.migration.namespace}/${this.migration.name}/${this.migration.version}`;

    try {
      await cloudWatchLogs.send(
        new CreateLogGroupCommand({
          logGroupName,
          tags: {
            namespace: this.migration.namespace,
            name: this.migration.name,
            version: `${this.migration.version}`,
            source: 'migration',
          },
        })
      );
    } catch (error) {
      if (error.code !== 'ResourceAlreadyExistsException') {
        throw error;
      }
      this.logger.debug(
        `Log Group ${logGroupName} already exists, skipping creation`
      );
    }

    return logGroupName;
  }

  private buildAndPushImage(
    ecrRepositoryBase: string,
    ecrRepoName: string,
    remoteDistFolder: string
  ) {
    this.logger.info('Building docker image');
    const imageTag = `${this.migration.namespace}-${this.migration.name}-${this.migration.version}`;
    const ecrImageTag = `${ecrRepositoryBase}/${ecrRepoName}:${imageTag}`;
    const buildResult = spawn.sync(
      'docker',
      ['build', '--platform=linux/amd64', '-t', imageTag, '.'],
      {
        cwd: remoteDistFolder,
        stdio: 'inherit',
      }
    );
    if (buildResult.status !== 0) {
      throw new ManagedMigrationError(`Failed to build docker image`);
    }

    this.logger.info('Tagging docker image to ECR');
    const tagResult = spawn.sync('docker', ['tag', imageTag, ecrImageTag], {
      cwd: remoteDistFolder,
      stdio: 'inherit',
    });
    if (tagResult.status !== 0) {
      throw new ManagedMigrationError(`Failed to tag the docker image`);
    }

    this.logger.info(
      `Pushing docker image ${ecrImageTag} to ${ecrRepoName} ECR repository`
    );
    const pushResult = spawn.sync('docker', ['push', ecrImageTag], {
      cwd: remoteDistFolder,
      stdio: 'inherit',
    });
    if (pushResult.status !== 0) {
      throw new ManagedMigrationError(`Failed to push the docker image`);
    }
    return ecrImageTag;
  }

  private dockerLogin(awsRegion: string, repo: string, publicEcr: boolean) {
    this.logger.debug(`Logging into ECR ${repo}`);
    execSync(
      `aws ${
        publicEcr ? 'ecr-public' : 'ecr'
      } get-login-password --region ${awsRegion} | docker login --username AWS --password-stdin ${repo}`,
      {
        stdio: 'inherit',
      }
    );
  }

  private async createEcrIfNotExists(ecrRepoName: string) {
    try {
      await ecr.send(
        new DescribeRepositoriesCommand({
          repositoryNames: [ecrRepoName],
        })
      );
    } catch (error) {
      if (error.code !== 'RepositoryNotFoundException') {
        throw error;
      }

      this.logger.info(`Creating ECR repository ${ecrRepoName}`);
      await ecr.send(
        new CreateRepositoryCommand({
          repositoryName: ecrRepoName,
        })
      );
    }
  }

  private async compileRemoteWrapper() {
    const distFolder = path.dirname(this.migration.distPath);
    const remoteDistFolder = path.join(distFolder, 'remote');
    const remoteWrapperFile = path.join(remoteDistFolder, 'wrapper.js');

    this.logger.debug(`Creating remote dist folder ${remoteDistFolder}`);
    fs.mkdirSync(remoteDistFolder, { recursive: true });

    this.logger.debug(`Copying Dockerfile to ${remoteDistFolder}`);
    fs.copyFileSync(
      path.join(__dirname, 'Dockerfile'),
      path.join(remoteDistFolder, 'Dockerfile')
    );

    this.logger.debug(`Compiling remote wrapper`);
    await esbuild.build({
      format: 'cjs',
      bundle: true,
      minify: false,
      sourcemap: false,
      target: ['node18'],
      entryPoints: [path.join(__dirname, 'wrapper.ts')],
      outfile: remoteWrapperFile,
      platform: 'node',
    });

    await esbuild.build({
      format: 'cjs',
      bundle: true,
      minify: false,
      sourcemap: false,
      target: ['node18'],
      entryPoints: [this.migration.path],
      outfile: path.join(remoteDistFolder, 'migration.js'),
      platform: 'node',
    });
    return remoteDistFolder;
  }
}
