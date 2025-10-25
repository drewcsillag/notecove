import {
  SimpleErrorHandlerRegistry,
  getGlobalErrorRegistry,
  setGlobalErrorRegistry,
  registerErrorHandler,
  unregisterErrorHandler,
  handleError,
  withErrorHandling,
} from '../error-handler';
import { AppError, ErrorCategory } from '../types';
import type { ErrorHandler } from '../types';

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/require-await */

describe('SimpleErrorHandlerRegistry', () => {
  let registry: SimpleErrorHandlerRegistry;
  let handler1: jest.MockedFunction<ErrorHandler>;
  let handler2: jest.MockedFunction<ErrorHandler>;

  beforeEach(() => {
    registry = new SimpleErrorHandlerRegistry();
    handler1 = jest.fn();
    handler2 = jest.fn();
  });

  describe('register / unregister', () => {
    it('should register a handler', () => {
      registry.register(handler1);
      const error = new Error('Test error');

      registry.handle(error);

      expect(handler1).toHaveBeenCalledWith(error);
      expect(handler1).toHaveBeenCalledTimes(1);
    });

    it('should register multiple handlers', () => {
      registry.register(handler1);
      registry.register(handler2);
      const error = new Error('Test error');

      registry.handle(error);

      expect(handler1).toHaveBeenCalledWith(error);
      expect(handler2).toHaveBeenCalledWith(error);
    });

    it('should unregister a handler', () => {
      registry.register(handler1);
      registry.register(handler2);
      registry.unregister(handler1);
      const error = new Error('Test error');

      registry.handle(error);

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledWith(error);
    });

    it('should handle unregistering non-existent handler gracefully', () => {
      registry.unregister(handler1);
      const error = new Error('Test error');

      expect(() => registry.handle(error)).not.toThrow();
    });
  });

  describe('handle', () => {
    it('should call all registered handlers', () => {
      registry.register(handler1);
      registry.register(handler2);
      const error = new Error('Test error');

      registry.handle(error);

      expect(handler1).toHaveBeenCalledWith(error);
      expect(handler2).toHaveBeenCalledWith(error);
    });

    it('should handle AppError', () => {
      registry.register(handler1);
      const appError = new AppError('App error', {
        category: ErrorCategory.Database,
        operation: 'test',
        component: 'test',
        recoverable: true,
      });

      registry.handle(appError);

      expect(handler1).toHaveBeenCalledWith(appError);
    });

    it('should continue with other handlers if one throws', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const failingHandler = jest.fn(() => {
        throw new Error('Handler failed');
      });

      registry.register(failingHandler);
      registry.register(handler1);
      const error = new Error('Test error');

      registry.handle(error);

      expect(failingHandler).toHaveBeenCalledWith(error);
      expect(handler1).toHaveBeenCalledWith(error);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });
});

describe('Global error registry', () => {
  let originalRegistry: ReturnType<typeof getGlobalErrorRegistry> | null = null;

  beforeEach(() => {
    // Save current registry
    originalRegistry = getGlobalErrorRegistry();
    // Reset to a fresh registry for each test
    setGlobalErrorRegistry(new SimpleErrorHandlerRegistry());
  });

  afterEach(() => {
    // Restore original registry
    if (originalRegistry) {
      setGlobalErrorRegistry(originalRegistry);
    }
  });

  describe('getGlobalErrorRegistry', () => {
    it('should return a registry instance', () => {
      const registry = getGlobalErrorRegistry();
      expect(registry).toBeInstanceOf(SimpleErrorHandlerRegistry);
    });

    it('should return the same instance on multiple calls', () => {
      const registry1 = getGlobalErrorRegistry();
      const registry2 = getGlobalErrorRegistry();
      expect(registry1).toBe(registry2);
    });
  });

  describe('setGlobalErrorRegistry', () => {
    it('should replace the global registry', () => {
      const customRegistry = new SimpleErrorHandlerRegistry();
      setGlobalErrorRegistry(customRegistry);

      const retrieved = getGlobalErrorRegistry();
      expect(retrieved).toBe(customRegistry);
    });
  });

  describe('registerErrorHandler', () => {
    it('should register handler in global registry', () => {
      const handler = jest.fn();
      registerErrorHandler(handler);

      const error = new Error('Test');
      handleError(error);

      expect(handler).toHaveBeenCalledWith(error);
    });
  });

  describe('unregisterErrorHandler', () => {
    it('should unregister handler from global registry', () => {
      const handler = jest.fn();
      registerErrorHandler(handler);
      unregisterErrorHandler(handler);

      const error = new Error('Test');
      handleError(error);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('handleError', () => {
    it('should handle error using global registry', () => {
      const handler = jest.fn();
      registerErrorHandler(handler);

      const error = new Error('Test error');
      handleError(error);

      expect(handler).toHaveBeenCalledWith(error);
    });
  });
});

describe('withErrorHandling', () => {
  let handler: jest.MockedFunction<ErrorHandler>;

  beforeEach(() => {
    handler = jest.fn();
    setGlobalErrorRegistry(new SimpleErrorHandlerRegistry());
    registerErrorHandler(handler);
  });

  describe('synchronous functions', () => {
    it('should return result when function succeeds', () => {
      const fn = jest.fn((x: number) => x * 2);
      const wrapped = withErrorHandling(fn);

      const result = wrapped(5);

      expect(result).toBe(10);
      expect(fn).toHaveBeenCalledWith(5);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle errors and re-throw AppError', () => {
      const fn = jest.fn(() => {
        throw new Error('Sync error');
      });
      const wrapped = withErrorHandling(fn, {
        operation: 'test-op',
        component: 'test-component',
      });

      expect(() => wrapped()).toThrow(AppError);

      expect(handler).toHaveBeenCalledTimes(1);
      const calledError = handler.mock.calls[0]?.[0] as AppError;
      expect(calledError).toBeInstanceOf(AppError);
      expect(calledError.message).toBe('Sync error');
      expect(calledError.context.operation).toBe('test-op');
      expect(calledError.context.component).toBe('test-component');
    });

    it('should preserve AppError if already thrown', () => {
      const originalError = new AppError('Original', {
        category: ErrorCategory.FileSystem,
        operation: 'original-op',
        component: 'original-component',
        recoverable: false,
      });
      const fn = jest.fn(() => {
        throw originalError;
      });
      const wrapped = withErrorHandling(fn);

      expect(() => wrapped()).toThrow(originalError);

      expect(handler).toHaveBeenCalledWith(originalError);
    });

    it('should use default context when not provided', () => {
      const fn = jest.fn(() => {
        throw new Error('Error');
      });
      const wrapped = withErrorHandling(fn);

      expect(() => wrapped()).toThrow(AppError);

      const calledError = handler.mock.calls[0]?.[0] as AppError;
      expect(calledError.context.operation).toBe('unknown');
      expect(calledError.context.component).toBe('unknown');
    });
  });

  describe('asynchronous functions', () => {
    it('should return result when async function succeeds', async () => {
      const fn = jest.fn(async (x: number) => x * 2);
      const wrapped = withErrorHandling(fn);

      const result = await wrapped(5);

      expect(result).toBe(10);
      expect(fn).toHaveBeenCalledWith(5);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle async errors and re-throw AppError', async () => {
      const fn = jest.fn(async () => {
        await Promise.resolve();
        throw new Error('Async error');
      });
      const wrapped = withErrorHandling(fn, {
        operation: 'async-op',
        component: 'async-component',
      });

      await expect(wrapped()).rejects.toThrow(AppError);

      expect(handler).toHaveBeenCalledTimes(1);
      const calledError = handler.mock.calls[0]?.[0] as AppError;
      expect(calledError).toBeInstanceOf(AppError);
      expect(calledError.message).toBe('Async error');
      expect(calledError.context.operation).toBe('async-op');
      expect(calledError.context.component).toBe('async-component');
    });

    it('should preserve AppError if already thrown in async function', async () => {
      const originalError = new AppError('Async original', {
        category: ErrorCategory.Network,
        operation: 'fetch',
        component: 'api',
        recoverable: true,
      });
      const fn = jest.fn(async () => {
        await Promise.resolve();
        throw originalError;
      });
      const wrapped = withErrorHandling(fn);

      await expect(wrapped()).rejects.toThrow(originalError);

      expect(handler).toHaveBeenCalledWith(originalError);
    });

    it('should handle promise rejection', async () => {
      const fn = jest.fn(() => Promise.reject(new Error('Rejected')));
      const wrapped = withErrorHandling(fn, {
        operation: 'promise-op',
        component: 'promise-component',
      });

      await expect(wrapped()).rejects.toThrow(AppError);

      const calledError = handler.mock.calls[0]?.[0] as AppError;
      expect(calledError.message).toBe('Rejected');
    });
  });

  describe('function signatures', () => {
    it('should preserve function signature with multiple args', () => {
      const fn = jest.fn((a: string, b: number, c: boolean) => `${a}-${b}-${c}`);
      const wrapped = withErrorHandling(fn);

      const result = wrapped('test', 42, true);

      expect(result).toBe('test-42-true');
      expect(fn).toHaveBeenCalledWith('test', 42, true);
    });

    it('should preserve void return type', () => {
      const fn = jest.fn(() => {
        // void function
      });
      const wrapped = withErrorHandling(fn);

      const result = wrapped();

      expect(result).toBeUndefined();
    });
  });
});
