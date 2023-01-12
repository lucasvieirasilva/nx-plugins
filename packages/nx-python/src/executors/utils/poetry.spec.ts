import { spawnSyncMock } from '../../utils/mocks/cross-spawn.mock';
const commandExistsMock = jest.fn();

jest.mock('command-exists', () => {
  return {
    __esModule: true,
    default: commandExistsMock,
  };
});

import { checkPoetryExecutable, runPoetry } from './poetry';

describe('Poetry Utils', () => {
  describe('Check Poetry Executable', () => {
    it('should check if poetry exists', () => {
      commandExistsMock.mockResolvedValue(undefined);

      expect(checkPoetryExecutable()).resolves.toBeUndefined();
    });

    it('should throw an exeception when poetry is not installed', () => {
      commandExistsMock.mockRejectedValue(null);

      expect(checkPoetryExecutable()).rejects.toThrowError(
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
      runPoetry(['install'], { cwd: '.' });
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
      runPoetry(['install'], { cwd: '/path' });
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
      runPoetry(['install'], { log: false });
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
      runPoetry(['install']);
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
      runPoetry(['install'], { cwd: '.', error: false });
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
      expect(() => runPoetry(['install'], { cwd: '.' })).toThrowError();
      expect(consoleLogSpy).toHaveBeenCalled();
      expect(spawnSyncMock).toHaveBeenCalledWith('poetry', ['install'], {
        cwd: '.',
        shell: false,
        stdio: 'inherit',
      });
    });
  });
});
