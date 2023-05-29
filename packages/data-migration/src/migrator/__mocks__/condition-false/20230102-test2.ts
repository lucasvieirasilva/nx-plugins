import { Migration, MigrationBase } from '../../..';

@Migration({
  namespace: 'test',
  version: 20230102,
  name: 'test1',
})
export default class extends MigrationBase {
  async condition() {
    return false;
  }

  async up() {
    this.logger.info('up');
  }

  async down() {
    this.logger.info('down');
  }
}
