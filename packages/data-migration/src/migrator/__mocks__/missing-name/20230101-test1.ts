import { Migration, MigrationBase } from '../../migration';

@Migration({
  namespace: 'test',
  version: 20230101,
  name: '',
})
export default class extends MigrationBase {
  async up() {
    this.logger.info('up');
  }

  async down() {
    this.logger.info('down');
  }
}
