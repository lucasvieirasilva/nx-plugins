import chalk from 'chalk';
import { spawnSyncMock } from '../../utils/mocks/child_process.mock';
import executor from './executor';
import { tmpdir } from 'os';
import { join } from 'path';
import { v4 as uuid } from "uuid";
import {
  mkdirsSync
} from 'fs-extra';

describe('Flake8 Executor', () => {

  let tmppath = null

  beforeEach(() => {
    tmppath = join(tmpdir(), 'nx-python', 'flake8', uuid())
  })

  beforeAll(() => {
    console.log(chalk`init chalk`);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should execute flake8 linting', async () => {
    const output = await executor(
      {
        outputFile: join(tmppath, 'reports/apps/app/pylint.txt'),
        silent: false,
      },
      {
        cwd: '',
        root: '.',
        isVerbose: false,
        projectName: 'app',
        workspace: {
          version: 2,
          npmScope: 'nxlv',
          projects: {
            app: {
              root: 'apps/app',
              targets: {},
            },
          },
        },
      }
    );
    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    expect(output.success).toBe(true);
  });


  it('should execute flake8 linting when the reports folder already exists', async () => {
    mkdirsSync(join(tmppath, 'reports/apps/app'))

    const output = await executor(
      {
        outputFile: join(tmppath, 'reports/apps/app/pylint.txt'),
        silent: false,
      },
      {
        cwd: '',
        root: '.',
        isVerbose: false,
        projectName: 'app',
        workspace: {
          version: 2,
          npmScope: 'nxlv',
          projects: {
            app: {
              root: 'apps/app',
              targets: {},
            },
          },
        },
      }
    );
    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    expect(output.success).toBe(true);
  });

  it('should returns a error when run the flake8 CLI', async () => {
    spawnSyncMock.mockImplementation(() => {
      throw new Error('Some error')
    })

    const output = await executor(
      {
        outputFile: join(tmppath, 'reports/apps/app/pylint.txt'),
        silent: false,
      },
      {
        cwd: '',
        root: '.',
        isVerbose: false,
        projectName: 'app',
        workspace: {
          version: 2,
          npmScope: 'nxlv',
          projects: {
            app: {
              root: 'apps/app',
              targets: {},
            },
          },
        },
      }
    );
    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    expect(output.success).toBe(false);
  });
});
