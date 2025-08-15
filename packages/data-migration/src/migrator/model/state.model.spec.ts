import '../../__mocks__/dynamoose.mock';
import { vi } from 'vitest';
import { model } from 'dynamoose';

describe('model', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();

    process.env.ENV = 'test';
  });

  it('should create a model with the default name', async () => {
    delete process.env.AWS_REGION;
    delete process.env.MIGRATION_TABLE_NAME;

    await import('./state.model');

    expect(model).toHaveBeenCalledWith(
      'migration-state-us-east-1-test',
      {},
      {
        create: true,
        throughput: 'ON_DEMAND',
        waitForActive: { check: { timeout: 300000 }, enabled: true },
      },
    );
  });

  it('should create a model with the custom name', async () => {
    delete process.env.AWS_REGION;
    process.env.MIGRATION_TABLE_NAME = 'custom-table-name';

    await import('./state.model');

    expect(model).toHaveBeenCalledWith(
      'custom-table-name',
      {},
      {
        create: true,
        throughput: 'ON_DEMAND',
        waitForActive: { check: { timeout: 300000 }, enabled: true },
      },
    );
  });

  it('should create a model with custom region', async () => {
    delete process.env.MIGRATION_TABLE_NAME;
    process.env.AWS_REGION = 'us-east-2';

    await import('./state.model');

    expect(model).toHaveBeenCalledWith(
      'migration-state-us-east-2-test',
      {},
      {
        create: true,
        throughput: 'ON_DEMAND',
        waitForActive: { check: { timeout: 300000 }, enabled: true },
      },
    );
  });
});
