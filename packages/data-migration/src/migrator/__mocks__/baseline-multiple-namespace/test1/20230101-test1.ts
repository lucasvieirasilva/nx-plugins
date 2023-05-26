import { Migration, MigrationBase } from '../../..';

@Migration({
  namespace: 'test1',
  version: 20230101,
  name: 'test1',
})
export default class extends MigrationBase {
  async up() {
    this.logger.info('up');
  }

  async down() {
    this.logger.info('down');
  }
}
