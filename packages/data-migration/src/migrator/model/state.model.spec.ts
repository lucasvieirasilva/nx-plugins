/* eslint-disable @typescript-eslint/no-var-requires */
// eslint-disable-next-line @nrwl/nx/enforce-module-boundaries
import { model } from '@nxlv/testing/dynamoose-mock';

describe('model', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();

    process.env.ENV = 'test';
  });

  it('should create a model with the default name', () => {
    delete process.env.AWS_REGION;
    delete process.env.MIGRATION_TABLE_NAME;

    require('./state.model');

    expect(model).toHaveBeenCalledWith(
      'migration-state-us-east-1-test',
      {},
      {
        create: true,
        throughput: 'ON_DEMAND',
        waitForActive: { check: { timeout: 300000 }, enabled: true },
      }
    );
  });

  it('should create a model with the custom name', () => {
    delete process.env.AWS_REGION;
    process.env.MIGRATION_TABLE_NAME = 'custom-table-name';

    require('./state.model');

    expect(model).toHaveBeenCalledWith(
      'custom-table-name',
      {},
      {
        create: true,
        throughput: 'ON_DEMAND',
        waitForActive: { check: { timeout: 300000 }, enabled: true },
      }
    );
  });

  it('should create a model with custom region', () => {
    delete process.env.MIGRATION_TABLE_NAME;
    process.env.AWS_REGION = 'us-east-2';

    require('./state.model');

    expect(model).toHaveBeenCalledWith(
      'migration-state-us-east-2-test',
      {},
      {
        create: true,
        throughput: 'ON_DEMAND',
        waitForActive: { check: { timeout: 300000 }, enabled: true },
      }
    );
  });
});
