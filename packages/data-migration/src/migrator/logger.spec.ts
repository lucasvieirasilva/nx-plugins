import { vi } from 'vitest';
import { CLILogger } from './logger';

type CLILoggerSpy = CLILogger & {
  logEntry: unknown;
};

describe('CLILogger', () => {
  let logger: CLILogger;

  beforeEach(() => {
    logger = new CLILogger('info');

    vi.useFakeTimers().setSystemTime(new Date('2023-01-01 12:00:00').getTime());
  });

  describe('info', () => {
    it('should call logEntry with the correct arguments', () => {
      const mockLogEntry = vi.spyOn(logger as CLILoggerSpy, 'logEntry');
      logger.info('test message');
      expect(mockLogEntry).toHaveBeenCalledWith(2, 'test message');
    });
  });

  describe('error', () => {
    it('should call logEntry with the correct arguments', () => {
      const mockLogEntry = vi.spyOn(logger as CLILoggerSpy, 'logEntry');
      logger.error('test message');
      expect(mockLogEntry).toHaveBeenCalledWith(4, 'test message');
    });
  });

  describe('warn', () => {
    it('should call logEntry with the correct arguments', () => {
      const mockLogEntry = vi.spyOn(logger as CLILoggerSpy, 'logEntry');
      logger.warn('test message');
      expect(mockLogEntry).toHaveBeenCalledWith(3, 'test message');
    });
  });

  describe('debug', () => {
    it('should call logEntry with the correct arguments', () => {
      const mockLogEntry = vi.spyOn(logger as CLILoggerSpy, 'logEntry');
      logger.debug('test message');
      expect(mockLogEntry).toHaveBeenCalledWith(1, 'test message');
    });
  });

  describe('logEntry', () => {
    it('should not log if log level is higher than the given level', () => {
      const mockConsoleDebug = vi.spyOn(console, 'debug');
      logger = new CLILogger('error');
      logger.debug('test message');
      expect(mockConsoleDebug).not.toHaveBeenCalled();

      logger = new CLILogger('debug');

      logger.debug('test message');
      expect(mockConsoleDebug).toHaveBeenCalled();
    });

    it('should log if log level is equal to the given level', () => {
      const mockConsoleWarn = vi.spyOn(console, 'warn');
      logger = new CLILogger('warn');
      logger.warn('test message');
      expect(mockConsoleWarn).toHaveBeenCalled();
    });

    it('should log with the correct format and color', () => {
      const mockConsoleLog = vi.spyOn(console, 'info');
      logger = new CLILogger('info');
      logger.info('test message');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining(`[${new Date().toISOString()}]`),
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[info]'),
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('test message'),
      );
    });
  });
});
