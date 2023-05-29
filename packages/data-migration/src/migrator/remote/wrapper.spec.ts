// eslint-disable-next-line @nrwl/nx/enforce-module-boundaries
import { modelMock } from '@nxlv/testing/dynamoose-mock';

describe('remote wrapper', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest
      .useFakeTimers()
      .setSystemTime(new Date('2023-01-01 12:00:00').getTime());

    process.env = { ...originalEnv };
  });

  describe('run', () => {
    it('should run the migration', (done) => {
      process.env.OPERATION = 'run';
      process.env.MIGRATION_FILE_NAME = './__mocks__/success/20230510-test1.ts';
      process.env.LOG_LEVEL = 'info';

      jest.spyOn(process, 'exit').mockImplementation((code) => {
        try {
          expect(code).toEqual(0);
          expect(modelMock.create).toHaveBeenCalledWith(
            {
              description: undefined,
              migrationPath: undefined,
              name: 'test1',
              namespace: 'test',
              startDate: new Date(),
              status: 'RUNNING',
              version: 20230510,
            },
            { overwrite: true }
          );
          expect(modelMock.update).toHaveBeenCalledWith(
            { namespace: 'test', version: 20230510 },
            { endDate: new Date(), status: 'SUCCESS' }
          );
          done();
        } catch (error) {
          done(error);
        }
        return undefined as never;
      });

      import('./wrapper').then(() => console.log('done'));
    });

    it('should fail the migration', (done) => {
      process.env.OPERATION = 'run';
      process.env.MIGRATION_FILE_NAME = './__mocks__/failure/20230510-test1.ts';
      process.env.LOG_LEVEL = 'info';

      jest.spyOn(process, 'exit').mockImplementation((code) => {
        try {
          expect(code).toEqual(9);
          expect(modelMock.create).toHaveBeenCalledWith(
            {
              description: undefined,
              migrationPath: undefined,
              name: 'test1',
              namespace: 'test',
              startDate: new Date(),
              status: 'RUNNING',
              version: 20230510,
            },
            { overwrite: true }
          );
          expect(modelMock.update).toHaveBeenCalledWith(
            { namespace: 'test', version: 20230510 },
            { endDate: new Date(), status: 'ERROR', errorMessage: 'up' }
          );
          done();
        } catch (error) {
          done(error);
        }
        return undefined as never;
      });

      import('./wrapper').then(() => console.log('done'));
    });
  });

  describe('rollback', () => {
    it('should rollback the migration successfully', (done) => {
      process.env.OPERATION = 'rollback';
      process.env.MIGRATION_FILE_NAME = './__mocks__/success/20230510-test1.ts';
      process.env.LOG_LEVEL = 'info';

      jest.spyOn(process, 'exit').mockImplementation((code) => {
        try {
          expect(code).toEqual(0);
          expect(modelMock.update).toHaveBeenNthCalledWith(
            1,
            { namespace: 'test', version: 20230510 },
            { rollbackStartDate: new Date(), status: 'ROLLBACK_RUNNING' }
          );
          expect(modelMock.update).toHaveBeenNthCalledWith(
            2,
            { namespace: 'test', version: 20230510 },
            { rollbackEndDate: new Date(), status: 'ROLLBACK_SUCCESS' }
          );
          done();
        } catch (error) {
          done(error);
        }
        return undefined as never;
      });

      import('./wrapper').then(() => console.log('done'));
    });

    it('should fail to rollback the migration', (done) => {
      process.env.OPERATION = 'rollback';
      process.env.MIGRATION_FILE_NAME =
        './__mocks__/failure-rollback/20230510-test1.ts';
      process.env.LOG_LEVEL = 'info';

      jest.spyOn(process, 'exit').mockImplementation((code) => {
        try {
          expect(code).toEqual(9);
          expect(modelMock.update).toHaveBeenNthCalledWith(
            1,
            { namespace: 'test', version: 20230510 },
            { rollbackStartDate: new Date(), status: 'ROLLBACK_RUNNING' }
          );
          expect(modelMock.update).toHaveBeenNthCalledWith(
            2,
            { namespace: 'test', version: 20230510 },
            {
              rollbackEndDate: new Date(),
              status: 'ROLLBACK_ERROR',
              errorMessage: 'down',
            }
          );
          done();
        } catch (error) {
          done(error);
        }
        return undefined as never;
      });

      import('./wrapper').then(() => console.log('done'));
    });
  });
});
