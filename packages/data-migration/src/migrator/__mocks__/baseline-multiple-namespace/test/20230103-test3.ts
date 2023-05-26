import { Migration, MigrationBase } from '../../..';

@Migration({
  namespace: 'test',
  version: 20230103,
  name: 'test3',
  baseline: true,
})
export default class extends MigrationBase {
  async up() {
    this.logger.info('up');
  }

  async down() {
    this.logger.info('down');
  }
}
