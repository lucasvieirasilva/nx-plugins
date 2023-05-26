import { Migration, MigrationBase } from '../../migration';

@Migration({
  namespace: 'test',
  version: 20230101,
  name: 'test1',
  remote: {
    type: 'ecs',
    config: {
      cluster: {
        value: 'cluster',
      },
      cpu: 1024,
      memory: 2048,
      executionRoleArn: {
        value: 'executionRoleArn',
      },
      taskRoleArn: {
        value: 'taskRoleArn',
      },
      networkMode: 'awsvpc',
      securityGroupId: {
        value: 'securityGroupId',
      },
      subnetIds: {
        value: 'subnets',
      },
    },
  },
})
export default class extends MigrationBase {
  async up() {
    this.logger.info('up');
  }

  async down() {
    this.logger.info('down');
  }
}
