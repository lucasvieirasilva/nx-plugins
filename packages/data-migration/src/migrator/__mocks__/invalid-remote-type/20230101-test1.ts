import { Migration, MigrationBase } from '../../migration';

@Migration({
  namespace: 'test',
  version: 20230101,
  name: 'test1',
  remote: {
    type: 'invalid',
    config: {},
  } as never,
})
export default class extends MigrationBase {
  async up() {
    this.logger.info('up');
  }

  async down() {
    this.logger.info('down');
  }
}
