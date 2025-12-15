/**
 * Tests for Structured Logger
 */

import { StructuredLogger, LogLevel, createLogger, configureLogger, getLogger } from '../logger';

describe('StructuredLogger', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleDebugSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Basic logging', () => {
    it('should log info messages', () => {
      const logger = new StructuredLogger();
      logger.info('Test message');

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('INFO'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Test message'));
    });

    it('should log debug messages when level is DEBUG', () => {
      const logger = new StructuredLogger({ minLevel: LogLevel.DEBUG });
      logger.debug('Debug message');

      expect(consoleDebugSpy).toHaveBeenCalledWith(expect.stringContaining('DEBUG'));
      expect(consoleDebugSpy).toHaveBeenCalledWith(expect.stringContaining('Debug message'));
    });

    it('should not log debug messages when level is INFO', () => {
      const logger = new StructuredLogger({ minLevel: LogLevel.INFO });
      logger.debug('Debug message');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it('should log warning messages', () => {
      const logger = new StructuredLogger();
      logger.warn('Warning message');

      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('WARN'));
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Warning message'));
    });

    it('should log error messages', () => {
      const logger = new StructuredLogger();
      logger.error('Error message');

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('ERROR'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error message'));
    });
  });

  describe('Context logging', () => {
    it('should include context in log messages', () => {
      const logger = new StructuredLogger();
      logger.info('Test message', {
        note_id: 'abc-123',
        duration_ms: 150,
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/note_id="abc-123".*duration_ms=150/)
      );
    });

    it('should filter out undefined and null context values', () => {
      const logger = new StructuredLogger();
      logger.info('Test message', {
        valid_key: 'value',
        null_key: null,
        undefined_key: undefined,
      });

      const loggedMessage = consoleLogSpy.mock.calls[0][0] as string;
      expect(loggedMessage).toContain('valid_key="value"');
      expect(loggedMessage).not.toContain('null_key');
      expect(loggedMessage).not.toContain('undefined_key');
    });

    it('should include default context in all messages', () => {
      const logger = new StructuredLogger({
        defaultContext: {
          app_version: '0.1.4',
        },
      });

      logger.info('Test message');

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('app_version="0.1.4"'));
    });

    it('should merge default context with message context', () => {
      const logger = new StructuredLogger({
        defaultContext: {
          app_version: '0.1.4',
        },
      });

      logger.info('Test message', {
        note_id: 'abc-123',
      });

      const loggedMessage = consoleLogSpy.mock.calls[0][0] as string;
      expect(loggedMessage).toContain('app_version="0.1.4"');
      expect(loggedMessage).toContain('note_id="abc-123"');
    });
  });

  describe('Prefix', () => {
    it('should include prefix in log messages', () => {
      const logger = new StructuredLogger({ prefix: 'CRDT Manager' });
      logger.info('Test message');

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[CRDT Manager]'));
    });
  });

  describe('Child logger', () => {
    it('should create child logger with additional prefix', () => {
      const parentLogger = new StructuredLogger({ prefix: 'CRDT' });
      const childLogger = parentLogger.child({ prefix: ':Snapshot' });

      childLogger.info('Test message');

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[CRDT:Snapshot]'));
    });

    it('should create child logger with additional context', () => {
      const parentLogger = new StructuredLogger({
        defaultContext: {
          app_version: '0.1.4',
        },
      });

      const childLogger = parentLogger.child({
        context: {
          sd_id: 'default',
        },
      });

      childLogger.info('Test message');

      const loggedMessage = consoleLogSpy.mock.calls[0][0] as string;
      expect(loggedMessage).toContain('app_version="0.1.4"');
      expect(loggedMessage).toContain('sd_id="default"');
    });

    it('should inherit min level from parent', () => {
      const parentLogger = new StructuredLogger({ minLevel: LogLevel.WARN });
      const childLogger = parentLogger.child({ prefix: ':Child' });

      childLogger.info('This should not log');
      childLogger.warn('This should log');

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should extract error context from Error objects', () => {
      const logger = new StructuredLogger();
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n  at test.ts:1:1';

      logger.error('Operation failed', error);

      const loggedMessage = consoleErrorSpy.mock.calls[0][0] as string;
      expect(loggedMessage).toContain('error_name="Error"');
      expect(loggedMessage).toContain('error_message="Test error"');
      expect(loggedMessage).toContain('error_stack');
    });

    it('should handle non-Error parameter gracefully', () => {
      const logger = new StructuredLogger();

      // Test with undefined error
      logger.error('Operation failed', undefined);

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Operation failed'));
    });

    it('should handle undefined error', () => {
      const logger = new StructuredLogger();

      logger.error('Operation failed', undefined);

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Operation failed'));
    });

    it('should merge error context with provided context', () => {
      const logger = new StructuredLogger();
      const error = new Error('Test error');

      logger.error('Operation failed', error, {
        note_id: 'abc-123',
      });

      const loggedMessage = consoleErrorSpy.mock.calls[0][0] as string;
      expect(loggedMessage).toContain('note_id="abc-123"');
      expect(loggedMessage).toContain('error_name="Error"');
      expect(loggedMessage).toContain('error_message="Test error"');
    });
  });

  describe('Log level control', () => {
    it('should respect minimum log level', () => {
      const logger = new StructuredLogger({ minLevel: LogLevel.WARN });

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should allow changing min level', () => {
      const logger = new StructuredLogger({ minLevel: LogLevel.INFO });

      logger.debug('Should not log');
      expect(consoleDebugSpy).not.toHaveBeenCalled();

      logger.setMinLevel(LogLevel.DEBUG);
      logger.debug('Should log');
      expect(consoleDebugSpy).toHaveBeenCalled();
    });
  });

  describe('Message formatting', () => {
    it('should include timestamp in ISO format', () => {
      const logger = new StructuredLogger();
      logger.info('Test message');

      const loggedMessage = consoleLogSpy.mock.calls[0][0] as string;
      // Check for ISO 8601 timestamp format (e.g., 2025-11-05T07:00:00.000Z)
      expect(loggedMessage).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    });

    it('should include log level in message', () => {
      const logger = new StructuredLogger();

      logger.info('Test');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(' INFO '));

      logger.warn('Test');
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(' WARN '));

      logger.error('Test');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(' ERROR '));
    });
  });

  describe('Global logger functions', () => {
    it('getLogger should return singleton instance', () => {
      const logger1 = getLogger();
      const logger2 = getLogger();

      expect(logger1).toBe(logger2);
    });

    it('createLogger should create child logger with prefix', () => {
      const logger = createLogger('TestModule');
      logger.info('Test message');

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[TestModule]'));
    });

    it('createLogger should create child logger with context', () => {
      const logger = createLogger('TestModule', { module_id: '123' });
      logger.info('Test message');

      const loggedMessage = consoleLogSpy.mock.calls[0][0] as string;
      expect(loggedMessage).toContain('[TestModule]');
      expect(loggedMessage).toContain('module_id="123"');
    });

    it('configureLogger should replace global logger', () => {
      configureLogger({
        minLevel: LogLevel.WARN,
        prefix: 'Global',
      });

      const logger = getLogger();
      logger.info('Should not log');
      logger.warn('Should log');

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('[Global]'));
    });
  });
});
