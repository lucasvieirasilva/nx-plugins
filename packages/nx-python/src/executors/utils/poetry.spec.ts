import { spawnSyncMock } from '../../utils/mocks/cross-spawn.mock';
import fsMock from 'mock-fs';
const commandExistsMock = jest.fn();

jest.mock('command-exists', () => {
  return {
    __esModule: true,
    default: commandExistsMock,
  };
});

import * as poetryUtils from './poetry';
import dedent from 'string-dedent';
import chalk from 'chalk';
import path from 'path';

describe('Poetry Utils', () => {
  beforeAll(() => {
    console.log(chalk`init chalk`);
  });

  afterEach(() => {
    fsMock.restore();
    jest.resetAllMocks();
  });

  describe('Check Poetry Executable', () => {
    it('should check if poetry exists', () => {
      commandExistsMock.mockResolvedValue(undefined);

      expect(poetryUtils.checkPoetryExecutable()).resolves.toBeUndefined();
    });

    it('should throw an exeception when poetry is not installed', () => {
      commandExistsMock.mockRejectedValue(null);

      expect(poetryUtils.checkPoetryExecutable()).rejects.toThrowError(
        'Poetry is not installed. Please install Poetry before running this command.'
      );
    });
  });

  describe('Run Poetry', () => {
    beforeEach(() => {
      jest.restoreAllMocks();
    });

    it('should run poetry with the given arguments', () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      spawnSyncMock.mockReturnValue({
        status: 0,
      });
      poetryUtils.runPoetry(['install'], { cwd: '.' });
      expect(consoleLogSpy).toHaveBeenCalled();
      expect(spawnSyncMock).toHaveBeenCalledWith('poetry', ['install'], {
        cwd: '.',
        shell: false,
        stdio: 'inherit',
      });
    });

    it('should run poetry at a different folder', () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      spawnSyncMock.mockReturnValue({
        status: 0,
      });
      poetryUtils.runPoetry(['install'], { cwd: '/path' });
      expect(consoleLogSpy).toHaveBeenCalled();
      expect(spawnSyncMock).toHaveBeenCalledWith('poetry', ['install'], {
        cwd: '/path',
        shell: false,
        stdio: 'inherit',
      });
    });

    it('should run poetry without log', () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      spawnSyncMock.mockReturnValue({
        status: 0,
      });
      poetryUtils.runPoetry(['install'], { log: false });
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(spawnSyncMock).toHaveBeenCalledWith('poetry', ['install'], {
        shell: false,
        stdio: 'inherit',
      });
    });

    it('should run poetry without options', () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      spawnSyncMock.mockReturnValue({
        status: 0,
      });
      poetryUtils.runPoetry(['install'], undefined);
      expect(consoleLogSpy).toHaveBeenCalled();
      expect(spawnSyncMock).toHaveBeenCalledWith('poetry', ['install'], {
        shell: false,
        stdio: 'inherit',
      });
    });

    it('should ignore the status when the option error is false', () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      spawnSyncMock.mockReturnValue({
        status: 1,
      });
      poetryUtils.runPoetry(['install'], { cwd: '.', error: false });
      expect(consoleLogSpy).toHaveBeenCalled();
      expect(spawnSyncMock).toHaveBeenCalledWith('poetry', ['install'], {
        cwd: '.',
        shell: false,
        stdio: 'inherit',
      });
    });

    it('should throw an error when the status is not 0', () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      spawnSyncMock.mockReturnValue({
        status: 1,
      });
      expect(() =>
        poetryUtils.runPoetry(['install'], { cwd: '.' })
      ).toThrowError();
      expect(consoleLogSpy).toHaveBeenCalled();
      expect(spawnSyncMock).toHaveBeenCalledWith('poetry', ['install'], {
        cwd: '.',
        shell: false,
        stdio: 'inherit',
      });
    });
  });

  describe('Get Poetry Version', () => {
    it('should get the poetry CLI version', async () => {
      spawnSyncMock.mockReturnValueOnce({
        status: 0,
        stdout: Buffer.from('Poetry (version 1.5.0)'),
      });

      const version = await poetryUtils.getPoetryVersion();

      expect(version).toEqual('1.5.0');

      spawnSyncMock.mockReturnValueOnce({
        status: 0,
        stdout: Buffer.from('\n\nSomething else\n\nPoetry (version 1.2.2)'),
      });

      const version2 = await poetryUtils.getPoetryVersion();

      expect(version2).toEqual('1.2.2');
    });

    it('should throw an error when the status is not 0', async () => {
      spawnSyncMock.mockReturnValueOnce({
        status: 1,
        error: true,
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
