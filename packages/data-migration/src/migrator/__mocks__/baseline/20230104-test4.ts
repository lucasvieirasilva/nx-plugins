import { Migration, MigrationBase } from '../../..';

@Migration({
  namespace: 'test',
  version: 20230104,
  name: 'test4',
})
export default class extends MigrationBase {
  async up() {
    this.logger.info('up');
  }

  async down() {
    this.logger.info('down');
  }
}
