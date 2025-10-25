import { ConsoleLogger } from '../console-logger';
import { LogLevel } from '../types';

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

describe('ConsoleLogger', () => {
  let logger: ConsoleLogger;
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    logger = new ConsoleLogger();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should default to Info level', () => {
      expect(logger.getLevel()).toBe(LogLevel.Info);
    });

    it('should accept initial log level', () => {
      const debugLogger = new ConsoleLogger(LogLevel.Debug);
      expect(debugLogger.getLevel()).toBe(LogLevel.Debug);
    });
  });

  describe('setLevel / getLevel', () => {
    it('should update log level', () => {
      logger.setLevel(LogLevel.Error);
      expect(logger.getLevel()).toBe(LogLevel.Error);
    });
  });

  describe('debug', () => {
    it('should log debug message when level is Debug', () => {
      logger.setLevel(LogLevel.Debug);
      logger.debug('Debug message');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const output = consoleLogSpy.mock.calls[0]?.[0];
      expect(typeof output).toBe('string');
      expect(output).toContain('DEBUG');
      expect(output).toContain('Debug message');
    });

    it('should not log debug when level is Info', () => {
      logger.setLevel(LogLevel.Info);
      logger.debug('Debug message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should include context in log', () => {
      logger.setLevel(LogLevel.Debug);
      logger.debug('With context', { userId: '123', action: 'test' });

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0]?.[0];
      expect(typeof output).toBe('string');
      expect(output).toContain('userId');
      expect(output).toContain('123');
    });
  });

  describe('info', () => {
    it('should log info message', () => {
      logger.info('Info message');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const output = consoleLogSpy.mock.calls[0]?.[0];
      expect(typeof output).toBe('string');
      expect(output).toContain('INFO');
      expect(output).toContain('Info message');
    });

    it('should not log info when level is Warn', () => {
      logger.setLevel(LogLevel.Warn);
      logger.info('Info message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('warn', () => {
    it('should log warning message', () => {
      logger.warn('Warning message');

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      const output = consoleWarnSpy.mock.calls[0]?.[0];
      expect(typeof output).toBe('string');
      expect(output).toContain('WARN');
      expect(output).toContain('Warning message');
    });

    it('should log warn when level is Info', () => {
      logger.setLevel(LogLevel.Info);
      logger.warn('Warning');

      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should not log warn when level is Error', () => {
      logger.setLevel(LogLevel.Error);
      logger.warn('Warning');

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('error', () => {
    it('should log error message', () => {
      logger.error('Error message');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const output = consoleErrorSpy.mock.calls[0]?.[0];
      expect(typeof output).toBe('string');
      expect(output).toContain('ERROR');
      expect(output).toContain('Error message');
    });

    it('should log error with Error object', () => {
      const error = new Error('Something went wrong');
      logger.error('Operation failed', error);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const output = consoleErrorSpy.mock.calls[0]?.[0];
      expect(typeof output).toBe('string');
      expect(output).toContain('Operation failed');
      expect(output).toContain('Something went wrong');
    });

    it('should log error with context and Error object', () => {
      const error = new Error('Failed');
      logger.error('Operation failed', error, { operation: 'save' });

      expect(consoleErrorSpy).toHaveBeenCalled();
      const output = consoleErrorSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain('Operation failed');
      expect(output).toContain('Failed');
      expect(output).toContain('operation');
    });

    it('should always log errors regardless of level', () => {
      logger.setLevel(LogLevel.Debug);
      logger.error('Error 1');
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

      consoleErrorSpy.mockClear();

      logger.setLevel(LogLevel.Info);
      logger.error('Error 2');
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

      consoleErrorSpy.mockClear();

      logger.setLevel(LogLevel.Warn);
      logger.error('Error 3');
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('message formatting', () => {
    it('should include timestamp in ISO format', () => {
      logger.info('Test message');

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0]?.[0] as string;
      // Check for ISO timestamp pattern
      expect(output).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should format level consistently', () => {
      logger.setLevel(LogLevel.Debug);

      logger.debug('Debug');
      const debugOutput = consoleLogSpy.mock.calls[0]?.[0];
      expect(typeof debugOutput).toBe('string');
      expect(debugOutput).toContain('DEBUG');

      logger.info('Info');
      const infoOutput = consoleLogSpy.mock.calls[1]?.[0];
      expect(typeof infoOutput).toBe('string');
      expect(infoOutput).toContain('INFO ');

      logger.warn('Warn');
      const warnOutput = consoleWarnSpy.mock.calls[0]?.[0];
      expect(typeof warnOutput).toBe('string');
      expect(warnOutput).toContain('WARN ');

      logger.error('Error');
      const errorOutput = consoleErrorSpy.mock.calls[0]?.[0];
      expect(typeof errorOutput).toBe('string');
      expect(errorOutput).toContain('ERROR');
    });
  });
});
