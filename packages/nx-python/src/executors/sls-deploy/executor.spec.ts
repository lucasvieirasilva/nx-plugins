import { vi, MockInstance } from 'vitest';
import { vol } from 'memfs';
import '../../utils/mocks/fs.mock';
import '../../utils/mocks/cross-spawn.mock';
import chalk from 'chalk';
import * as poetryUtils from '../utils/poetry';
import executor from './executor';
import spawn from 'cross-spawn';
import { ExecutorContext } from '@nx/devkit';

describe('Serverless Framework Deploy Executor', () => {
  let activateVenvMock: MockInstance;

  const context: ExecutorContext = {
    cwd: '',
    root: '.',
    isVerbose: false,
    projectName: 'app',
    projectsConfigurations: {
      version: 2,
      projects: {
        app: {
          root: 'apps/app',
          targets: {},
        },
      },
    },
    nxJsonConfiguration: {},
    projectGraph: {
      dependencies: {},
      nodes: {},
    },
  };

  beforeAll(() => {
    console.log(chalk`init chalk`);
  });

  beforeEach(() => {
    activateVenvMock = vi
      .spyOn(poetryUtils, 'activateVenv')
      .mockReturnValue(undefined);
    vi.spyOn(process, 'chdir').mockReturnValue(undefined);
  });

  afterEach(() => {
    vol.reset();
    vi.resetAllMocks();
  });

  it('should throw an exception when the dist folder is empty', async () => {
    const output = await executor(
      {
        stage: 'dev',
        verbose: true,
        force: false,
      },
      context,
    );
    expect(activateVenvMock).toHaveBeenCalledWith('.');
    expect(spawn.sync).not.toHaveBeenCalled();
    expect(output.success).toBe(false);
  });

  it('should throw an exception when the whl file does not exist', async () => {
    vol.fromJSON({
      'apps/app/dist/test.tar.gz': 'abc123',
    });

    const output = await executor(
      {
        stage: 'dev',
        verbose: true,
        force: false,
      },
      context,
    );
    expect(activateVenvMock).toHaveBeenCalledWith('.');
    expect(spawn.sync).not.toHaveBeenCalled();
    expect(output.success).toBe(false);
  });

  it('should run serverless framework command using npx', async () => {
    vol.fromJSON({
      'apps/app/dist/test.whl': 'abc123',
    });
    vi.mocked(spawn.sync).mockReturnValue({
      status: 0,
      output: [''],
      pid: 0,
      signal: null,
      stderr: null,
      stdout: null,
    });

    const output = await executor(
      {
        stage: 'dev',
        verbose: false,
        force: false,
      },
      context,
    );
    expect(activateVenvMock).toHaveBeenCalledWith('.');
    expect(spawn.sync).toHaveBeenCalledWith(
      'npx',
      ['sls', 'deploy', '--stage', 'dev'],
      {
        cwd: 'apps/app',
        stdio: 'inherit',
        shell: false,
      },
    );
    expect(output.success).toBe(true);
  });

  it('should run serverless framework command with error status code', async () => {
    vol.fromJSON({
      'apps/app/dist/test.whl': 'abc123',
    });
    vi.mocked(spawn.sync).mockReturnValue({
      status: 1,
      output: [''],
      pid: 0,
      signal: null,
      stderr: null,
      stdout: null,
    });

    const output = await executor(
      {
        stage: 'dev',
        verbose: false,
        force: false,
      },
      context,
    );
    expect(activateVenvMock).toHaveBeenCalledWith('.');
    expect(spawn.sync).toHaveBeenCalledWith(
      'npx',
      ['sls', 'deploy', '--stage', 'dev'],
      {
        cwd: 'apps/app',
        stdio: 'inherit',
        shell: false,
      },
    );
    expect(output.success).toBe(false);
  });

  it('should run serverless framework command using npx with verbose and force', async () => {
    vol.fromJSON({
      'apps/app/dist/test.whl': 'abc123',
    });
    vi.mocked(spawn.sync).mockReturnValue({
      status: 0,
      output: [''],
      pid: 0,
      signal: null,
      stderr: null,
      stdout: null,
    });

    const output = await executor(
      {
        stage: 'dev',
        verbose: true,
        force: true,
      },
      context,
    );
    expect(activateVenvMock).toHaveBeenCalledWith('.');
    expect(spawn.sync).toHaveBeenCalledWith(
      'npx',
      ['sls', 'deploy', '--stage', 'dev', '--verbose', '--force'],
      {
        cwd: 'apps/app',
        stdio: 'inherit',
        shell: false,
      },
    );
    expect(output.success).toBe(true);
  });
});
