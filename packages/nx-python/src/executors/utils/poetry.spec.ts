import { vi } from 'vitest';
import '../../utils/mocks/cross-spawn.mock';
import fsMock from 'mock-fs';

vi.mock('command-exists', () => {
  return {
    __esModule: true,
    default: vi.fn(),
  };
});

import * as poetryUtils from './poetry';
import dedent from 'string-dedent';
import chalk from 'chalk';
import path from 'path';
import spawn from 'cross-spawn';
import commandExists from 'command-exists';

describe('Poetry Utils', () => {
  beforeAll(() => {
    console.log(chalk`init chalk`);
  });

  afterEach(() => {
    fsMock.restore();
    vi.resetAllMocks();
  });

  describe('Check Poetry Executable', () => {
    it('should check if poetry exists', () => {
      commandExists.mockResolvedValue(undefined);

      expect(poetryUtils.checkPoetryExecutable()).resolves.toBeUndefined();
    });

    it('should throw an exeception when poetry is not installed', () => {
      commandExists.mockRejectedValue(null);

      expect(poetryUtils.checkPoetryExecutable()).rejects.toThrowError(
        'Poetry is not installed. Please install Poetry before running this command.',
      );
    });
  });

  describe('Run Poetry', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('should run poetry with the given arguments', () => {
      const consoleLogSpy = vi.spyOn(console, 'log');
      vi.mocked(spawn.sync).mockReturnValue({
        status: 0,
        output: [''],
        pid: 0,
        signal: null,
        stderr: null,
        stdout: null,
      });
      poetryUtils.runPoetry(['install'], { cwd: '.' });
      expect(consoleLogSpy).toHaveBeenCalled();
      expect(spawn.sync).toHaveBeenCalledWith('poetry', ['install'], {
        cwd: '.',
        shell: false,
        stdio: 'inherit',
      });
    });

    it('should run poetry at a different folder', () => {
      const consoleLogSpy = vi.spyOn(console, 'log');
      vi.mocked(spawn.sync).mockReturnValue({
        status: 0,
        output: [''],
        pid: 0,
        signal: null,
        stderr: null,
        stdout: null,
      });
      poetryUtils.runPoetry(['install'], { cwd: '/path' });
      expect(consoleLogSpy).toHaveBeenCalled();
      expect(spawn.sync).toHaveBeenCalledWith('poetry', ['install'], {
        cwd: '/path',
        shell: false,
        stdio: 'inherit',
      });
    });

    it('should run poetry without log', () => {
      const consoleLogSpy = vi.spyOn(console, 'log');
      vi.mocked(spawn.sync).mockReturnValue({
        status: 0,
        output: [''],
        pid: 0,
        signal: null,
        stderr: null,
        stdout: null,
      });
      poetryUtils.runPoetry(['install'], { log: false });
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(spawn.sync).toHaveBeenCalledWith('poetry', ['install'], {
        shell: false,
        stdio: 'inherit',
      });
    });

    it('should run poetry without options', () => {
      const consoleLogSpy = vi.spyOn(console, 'log');
      vi.mocked(spawn.sync).mockReturnValue({
        status: 0,
        output: [''],
        pid: 0,
        signal: null,
        stderr: null,
        stdout: null,
      });
      poetryUtils.runPoetry(['install'], undefined);
      expect(consoleLogSpy).toHaveBeenCalled();
      expect(spawn.sync).toHaveBeenCalledWith('poetry', ['install'], {
        shell: false,
        stdio: 'inherit',
      });
    });

    it('should ignore the status when the option error is false', () => {
      const consoleLogSpy = vi.spyOn(console, 'log');
      vi.mocked(spawn.sync).mockReturnValue({
        status: 1,
        output: [''],
        pid: 0,
        signal: null,
        stderr: null,
        stdout: null,
      });
      poetryUtils.runPoetry(['install'], { cwd: '.', error: false });
      expect(consoleLogSpy).toHaveBeenCalled();
      expect(spawn.sync).toHaveBeenCalledWith('poetry', ['install'], {
        cwd: '.',
        shell: false,
        stdio: 'inherit',
      });
    });

    it('should throw an error when the status is not 0', () => {
      const consoleLogSpy = vi.spyOn(console, 'log');
      vi.mocked(spawn.sync).mockReturnValue({
        status: 1,
        output: [''],
        pid: 0,
        signal: null,
        stderr: null,
        stdout: null,
      });
      expect(() =>
        poetryUtils.runPoetry(['install'], { cwd: '.' }),
      ).toThrowError();
      expect(consoleLogSpy).toHaveBeenCalled();
      expect(spawn.sync).toHaveBeenCalledWith('poetry', ['install'], {
        cwd: '.',
        shell: false,
        stdio: 'inherit',
      });
    });
  });

  describe('Get Poetry Version', () => {
    it('should get the poetry CLI version', async () => {
      vi.mocked(spawn.sync).mockReturnValueOnce({
        status: 0,
        stdout: Buffer.from('Poetry (version 1.5.0)'),
        output: [''],
        pid: 0,
        signal: null,
        stderr: null,
      });

      const version = await poetryUtils.getPoetryVersion();

      expect(version).toEqual('1.5.0');

      vi.mocked(spawn.sync).mockReturnValueOnce({
        status: 0,
        stdout: Buffer.from('\n\nSomething else\n\nPoetry (version 1.2.2)'),
        output: [''],
        pid: 0,
        signal: null,
        stderr: null,
      });

      const version2 = await poetryUtils.getPoetryVersion();

      expect(version2).toEqual('1.2.2');
    });

    it('should throw an error when the status is not 0', async () => {
      vi.mocked(spawn.sync).mockReturnValueOnce({
        status: 1,
        error: new Error(),
        output: [''],
        pid: 0,
        signal: null,
        stderr: null,
        stdout: null,
      });

      await expect(poetryUtils.getPoetryVersion()).rejects.toThrowError();
    });
  });

  describe('Activate Venv', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    it('should not activate venv when it is already activated', () => {
      process.env.VIRTUAL_ENV = 'venv';

      poetryUtils.activateVenv('.');

      expect(process.env).toStrictEqual({
        ...originalEnv,
        VIRTUAL_ENV: 'venv',
      });
    });

    it('should not activate venv when the root pyproject.toml does not exists', () => {
      delete process.env.VIRTUAL_ENV;

      poetryUtils.activateVenv('.');

      expect(process.env).toEqual(originalEnv);
    });

    it('should not activate venv when the root pyproject.toml exists and the autoActivate property is not defined', () => {
      delete process.env.VIRTUAL_ENV;

      fsMock({
        'pyproject.toml': dedent`
        [tool.poetry]
        name = "app"
        version = "1.0.0"
          [tool.poetry.dependencies]
          python = "^3.8"
        `,
      });

      poetryUtils.activateVenv('.');

      expect(process.env).toEqual(originalEnv);
    });

    it('should activate venv when the root pyproject.toml exists and the autoActivate property is defined', () => {
      delete process.env.VIRTUAL_ENV;

      fsMock({
        'pyproject.toml': dedent`
        [tool.nx]
        autoActivate = true

        [tool.poetry]
        name = "app"
        version = "1.0.0"
          [tool.poetry.dependencies]
          python = "^3.8"
        `,
      });

      poetryUtils.activateVenv('.');

      expect(process.env).toEqual({
        ...originalEnv,
        VIRTUAL_ENV: path.resolve('.venv'),
        PATH: `${path.resolve('.venv')}/bin:${originalEnv.PATH}`,
      });
    });
  });
});
