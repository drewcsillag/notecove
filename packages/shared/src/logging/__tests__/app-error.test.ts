import { AppError, ErrorCategory } from '../types';

/* eslint-disable @typescript-eslint/no-unsafe-assignment */

describe('AppError', () => {
  describe('constructor', () => {
    it('should create an AppError with message and context', () => {
      const error = new AppError('Test error', {
        category: ErrorCategory.Database,
        operation: 'insert',
        component: 'storage',
        recoverable: true,
      });

      expect(error.message).toBe('Test error');
      expect(error.name).toBe('AppError');
      expect(error.context.category).toBe(ErrorCategory.Database);
      expect(error.context.operation).toBe('insert');
      expect(error.context.component).toBe('storage');
      expect(error.context.recoverable).toBe(true);
    });

    it('should create an AppError with cause', () => {
      const cause = new Error('Original error');
      const error = new AppError(
        'Wrapped error',
        {
          category: ErrorCategory.FileSystem,
          operation: 'read',
          component: 'fs',
          recoverable: false,
        },
        cause
      );

      expect(error.message).toBe('Wrapped error');
      expect(error.cause).toBe(cause);
    });

    it('should capture stack trace', () => {
      const error = new AppError('Test error', {
        category: ErrorCategory.Validation,
        operation: 'validate',
        component: 'validator',
        recoverable: true,
      });

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AppError');
    });

    it('should work without category', () => {
      const error = new AppError('Test error', {
        operation: 'test',
        component: 'test',
        recoverable: false,
      });

      expect(error.context.category).toBeUndefined();
      expect(error.context.operation).toBe('test');
    });
  });

  describe('toJSON', () => {
    it('should serialize to JSON without cause', () => {
      const error = new AppError('Test error', {
        category: ErrorCategory.Network,
        operation: 'fetch',
        component: 'api',
        recoverable: true,
        userId: '123',
        requestId: 'req-456',
      });

      const json = error.toJSON();

      expect(json.name).toBe('AppError');
      expect(json.message).toBe('Test error');
      expect(typeof json.context).toBe('object');
      expect(json.context.category).toBe(ErrorCategory.Network);
      expect(json.context.operation).toBe('fetch');
      expect(json.context.component).toBe('api');
      expect(json.context.recoverable).toBe(true);
      expect(json.context.userId).toBe('123');
      expect(json.context.requestId).toBe('req-456');
      expect(json.cause).toBeUndefined();
      expect(json.stack).toBeDefined();
    });

    it('should serialize to JSON with cause', () => {
      const cause = new Error('Root cause');
      cause.stack = 'Root cause stack trace';

      const error = new AppError(
        'Wrapped error',
        {
          category: ErrorCategory.Database,
          operation: 'query',
          component: 'db',
          recoverable: false,
        },
        cause
      );

      const json = error.toJSON();

      expect(typeof json.cause).toBe('object');
      if (json.cause && typeof json.cause === 'object') {
        expect(json.cause.name).toBe('Error');
        expect(json.cause.message).toBe('Root cause');
        expect(json.cause.stack).toBe('Root cause stack trace');
      }
    });

    it('should include additional context fields', () => {
      const error = new AppError('Test error', {
        category: ErrorCategory.CRDT,
        operation: 'merge',
        component: 'sync',
        recoverable: true,
        noteId: 'note-123',
        instanceId: 'instance-456',
        conflictCount: 3,
      });

      const json = error.toJSON();

      expect(typeof json.context).toBe('object');
      expect(json.context.noteId).toBe('note-123');
      expect(json.context.instanceId).toBe('instance-456');
      expect(json.context.conflictCount).toBe(3);
    });

    it('should be JSON stringifiable', () => {
      const error = new AppError('Test error', {
        category: ErrorCategory.Validation,
        operation: 'parse',
        component: 'parser',
        recoverable: true,
      });

      expect(() => JSON.stringify(error.toJSON())).not.toThrow();

      const jsonString = JSON.stringify(error.toJSON());
      const parsed: unknown = JSON.parse(jsonString);

      expect(typeof parsed).toBe('object');
      if (parsed && typeof parsed === 'object' && 'name' in parsed) {
        expect(parsed.name).toBe('AppError');
      }
      if (parsed && typeof parsed === 'object' && 'message' in parsed) {
        expect(parsed.message).toBe('Test error');
      }
      if (
        parsed &&
        typeof parsed === 'object' &&
        'context' in parsed &&
        parsed.context &&
        typeof parsed.context === 'object' &&
        'category' in parsed.context
      ) {
        expect(parsed.context.category).toBe(ErrorCategory.Validation);
      }
    });
  });

  describe('error categories', () => {
    it('should support Database category', () => {
      const error = new AppError('DB error', {
        category: ErrorCategory.Database,
        operation: 'query',
        component: 'db',
        recoverable: false,
      });

      expect(error.context.category).toBe(ErrorCategory.Database);
    });

    it('should support FileSystem category', () => {
      const error = new AppError('FS error', {
        category: ErrorCategory.FileSystem,
        operation: 'write',
        component: 'fs',
        recoverable: true,
      });

      expect(error.context.category).toBe(ErrorCategory.FileSystem);
    });

    it('should support Network category', () => {
      const error = new AppError('Network error', {
        category: ErrorCategory.Network,
        operation: 'fetch',
        component: 'api',
        recoverable: true,
      });

      expect(error.context.category).toBe(ErrorCategory.Network);
    });

    it('should support CRDT category', () => {
      const error = new AppError('CRDT error', {
        category: ErrorCategory.CRDT,
        operation: 'merge',
        component: 'sync',
        recoverable: false,
      });

      expect(error.context.category).toBe(ErrorCategory.CRDT);
    });

    it('should support Validation category', () => {
      const error = new AppError('Validation error', {
        category: ErrorCategory.Validation,
        operation: 'validate',
        component: 'validator',
        recoverable: true,
      });

      expect(error.context.category).toBe(ErrorCategory.Validation);
    });

    it('should support Unknown category', () => {
      const error = new AppError('Unknown error', {
        category: ErrorCategory.Unknown,
        operation: 'unknown',
        component: 'unknown',
        recoverable: false,
      });

      expect(error.context.category).toBe(ErrorCategory.Unknown);
    });
  });

  describe('inheritance', () => {
    it('should be instanceof Error', () => {
      const error = new AppError('Test', {
        operation: 'test',
        component: 'test',
        recoverable: false,
      });

      expect(error instanceof Error).toBe(true);
    });

    it('should be instanceof AppError', () => {
      const error = new AppError('Test', {
        operation: 'test',
        component: 'test',
        recoverable: false,
      });

      expect(error instanceof AppError).toBe(true);
    });

    it('should work with try-catch', () => {
      const error = new AppError('Test', {
        operation: 'test',
        component: 'test',
        recoverable: false,
      });

      try {
        throw error;
      } catch (e) {
        expect(e).toBe(error);
        expect(e instanceof AppError).toBe(true);
      }
    });
  });
});
