import chalk from 'chalk';
import { spawnSyncMock } from '../../utils/mocks/cross-spawn.mock';
import executor from './executor';
import fsMock from 'mock-fs';

describe('Serverless Framework Deploy Executor', () => {

  const context = {
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

  beforeAll(() => {
    console.log(chalk`init chalk`);
  });

  afterEach(() => {
    fsMock.restore();
    jest.resetAllMocks();
  });

  it('should throw an exception when the dist folder is empty', async () => {
    const output = await executor(
      {
        stage: 'dev',
        verbose: true,
        force: false
      },
      context
    );
    expect(spawnSyncMock).not.toHaveBeenCalled()
    expect(output.success).toBe(false);
  });

  it('should throw an exception when the whl file does not exist', async () => {
    fsMock({
      'apps/app/dist/test.tar.gz': 'abc123'
    })

    const output = await executor(
      {
        stage: 'dev',
        verbose: true,
        force: false
      },
      context
    );
    expect(spawnSyncMock).not.toHaveBeenCalled()
    expect(output.success).toBe(false);
  });

  it('should run serverless framework command using npx', async () => {
    fsMock({
      'apps/app/dist/test.whl': 'abc123'
    })
    spawnSyncMock.mockReturnValue({
      status: 0
    })

    const output = await executor(
      {
        stage: 'dev',
        verbose: false,
        force: false
      },
      context
    );
    expect(spawnSyncMock).toHaveBeenCalledWith(
      'npx',
      [
        'sls',
        'deploy',
        '--stage',
        'dev'
      ],
      {
        cwd: 'apps/app',
        stdio: 'inherit',
        shell: false
      }
    )
    expect(output.success).toBe(true);
  });

  it('should run serverless framework command with error status code', async () => {
    fsMock({
      'apps/app/dist/test.whl': 'abc123'
    })
    spawnSyncMock.mockReturnValue({
      status: 1
    })

    const output = await executor(
      {
        stage: 'dev',
        verbose: false,
        force: false
      },
      context
    );
    expect(spawnSyncMock).toHaveBeenCalledWith(
      'npx',
      [
        'sls',
        'deploy',
        '--stage',
        'dev'
      ],
      {
        cwd: 'apps/app',
        stdio: 'inherit',
        shell: false
      }
    )
    expect(output.success).toBe(false);
  });

  it('should run serverless framework command using npx with verbose and force', async () => {
    fsMock({
      'apps/app/dist/test.whl': 'abc123'
    })
    spawnSyncMock.mockReturnValue({
      status: 0
    })

    const output = await executor(
      {
        stage: 'dev',
        verbose: true,
        force: true
      },
      context
    );
    expect(spawnSyncMock).toHaveBeenCalledWith(
      'npx',
      [
        'sls',
        'deploy',
        '--stage',
        'dev',
        '--verbose',
        '--force'
      ],
      {
        cwd: 'apps/app',
        stdio: 'inherit',
        shell: false
      }
    )
    expect(output.success).toBe(true);
  });
});
