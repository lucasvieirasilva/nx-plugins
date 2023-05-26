import { NetworkMode, AssignPublicIp } from '@aws-sdk/client-ecs';
import { CLILogger } from './logger';
import { LifecycleHook } from './types';

export type RemoteConfigParam = {
  value: string;
  type?: 'plain' | 'ssm';
  decrypt?: boolean;
};

export type RemoteConfig = {
  type: 'ecs';
  config: RemoteEcsConfig;
};

export type RemoteEcsConfig = {
  cluster: RemoteConfigParam;
  executionRoleArn: RemoteConfigParam;
  taskRoleArn: RemoteConfigParam;
  cpu: number;
  memory: number;
  networkMode: NetworkMode;
  subnetIds: RemoteConfigParam;
  securityGroupId: RemoteConfigParam;
  assignPublicIp?: AssignPublicIp;
};

export type MigrationOptions = {
  namespace: string;
  version: number;
  name: string;
  description?: string;
  lifecycleHook?: LifecycleHook;
  parentVersion?: number;
  baseline?: boolean;
  remote?: RemoteConfig;
};

export function Migration(options: MigrationOptions) {
  return function <T extends { new (...args) }>(constructor: T) {
    return class extends constructor {
      namespace = options.namespace;
      version = options.version;
      name = options.name;
      description = options.description;
      lifecycleHook = options.lifecycleHook ?? LifecycleHook.BEFORE_DEPLOY;
      parentVersion = options.parentVersion;
      baseline = options.baseline;
      remote = options.remote;
    };
  };
}

export abstract class MigrationBase {
  public readonly namespace: string;
  public readonly version: number;
  public readonly name: string;
  public readonly description: string;
  public readonly lifecycleHook: LifecycleHook;
  public readonly parentVersion?: number;
  public readonly baseline?: boolean;
  public readonly remote?: RemoteConfig;

  public distPath: string;
  public path: string;
  public logger: CLILogger;

  abstract up(): Promise<void>;
  abstract down(): Promise<void>;

  async sleep(seconds: number) {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }

  async condition(): Promise<boolean> {
    return true;
  }
}
