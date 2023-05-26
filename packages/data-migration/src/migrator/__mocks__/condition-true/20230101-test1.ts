import { Migration, MigrationBase } from '../../..';

@Migration({
  namespace: 'test',
  version: 20230101,
  name: 'test1',
})
export default class extends MigrationBase {
  async condition(): Promise<boolean> {
    return true;
  }

  async up() {
    this.logger.info('up');
  }

  async down() {
    this.logger.info('down');
  }
}
