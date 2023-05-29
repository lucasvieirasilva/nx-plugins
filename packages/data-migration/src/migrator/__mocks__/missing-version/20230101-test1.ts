import { Migration, MigrationBase } from '../../migration';

@Migration({
  namespace: 'test',
  version: 0,
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
