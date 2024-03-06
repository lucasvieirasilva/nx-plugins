import { vi, MockInstance } from 'vitest';
import '../../utils/mocks/cross-spawn.mock';
import chalk from 'chalk';
import * as poetryUtils from '../utils/poetry';
import executor from './executor';
import fsMock from 'mock-fs';
import spawn from 'cross-spawn';

describe('Serverless Framework Package Executor', () => {
  let activateVenvMock: MockInstance;

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
  };

  beforeEach(() => {
    activateVenvMock = vi
      .spyOn(poetryUtils, 'activateVenv')
      .mockReturnValue(undefined);
    vi.spyOn(process, 'chdir').mockReturnValue(undefined);
  });

  beforeAll(() => {
    console.log(chalk`init chalk`);
  });

  afterEach(() => {
    fsMock.restore();
    vi.resetAllMocks();
  });

  it('should throw an exception when the dist folder is empty', async () => {
    const output = await executor(
      {
        stage: 'dev',
      },
      context,
    );
    expect(activateVenvMock).toHaveBeenCalledWith('.');
    expect(spawn.sync).not.toHaveBeenCalled();
    expect(output.success).toBe(false);
  });

  it('should throw an exception when the whl file does not exist', async () => {
    fsMock({
      'apps/app/dist/test.tar.gz': 'abc123',
    });

    const output = await executor(
      {
        stage: 'dev',
      },
      context,
    );
    expect(activateVenvMock).toHaveBeenCalledWith('.');
    expect(spawn.sync).not.toHaveBeenCalled();
    expect(output.success).toBe(false);
  });

  it('should run serverless framework command using npx', async () => {
    fsMock({
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
      },
      context,
    );
    expect(activateVenvMock).toHaveBeenCalledWith('.');
    expect(spawn.sync).toHaveBeenCalledWith(
      'npx',
      ['sls', 'package', '--stage', 'dev'],
      {
        cwd: 'apps/app',
        stdio: 'inherit',
        shell: false,
      },
    );
    expect(output.success).toBe(true);
  });

  it('should run serverless framework command with error', async () => {
    fsMock({
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
      },
      context,
    );
    expect(activateVenvMock).toHaveBeenCalledWith('.');
    expect(spawn.sync).toHaveBeenCalledWith(
      'npx',
      ['sls', 'package', '--stage', 'dev'],
      {
        cwd: 'apps/app',
        stdio: 'inherit',
        shell: false,
      },
    );
    expect(output.success).toBe(false);
  });
});
