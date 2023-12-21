import { Migration, MigrationBase } from './migration';

describe('Migration', () => {
  it('should inject migration options', () => {
    @Migration({
      namespace: 'test',
      version: 1,
      name: 'test',
    })
    class TestMigration extends MigrationBase {
      up() {
        return Promise.resolve();
      }
      down() {
        return Promise.resolve();
      }
    }

    const migration = new TestMigration() as MigrationBase;

    expect(migration.namespace).toEqual('test');
    expect(migration.version).toEqual(1);
    expect(migration.name).toEqual('test');
  });

  it('should wait for x seconds', async () => {
    @Migration({
      namespace: 'test',
      version: 1,
      name: 'test',
    })
    class TestMigration extends MigrationBase {
      async up() {
        console.log('up');
      }
      async down() {
        console.log('down');
      }
    }

    const migration = new TestMigration() as MigrationBase;
    const timeoutMock = jest
      .spyOn(global, 'setTimeout')
      .mockImplementation(
        (fn: (args: void) => void) => fn() as unknown as NodeJS.Timeout
      );

    await migration.sleep(1);

    expect(timeoutMock).toHaveBeenCalledTimes(1);
    expect(timeoutMock).toHaveBeenLastCalledWith(expect.any(Function), 1000);
  });

  it('should return true by default', async () => {
    @Migration({
      namespace: 'test',
      version: 1,
      name: 'test',
    })
    class TestMigration extends MigrationBase {
      async up() {
        console.log('up');
      }
      async down() {
        console.log('down');
      }
    }

    const migration = new TestMigration() as MigrationBase;

    expect(await migration.condition()).toBe(true);
  });
});
