/**
 * Error handling utilities
 */

import type { ErrorHandler, ErrorHandlerRegistry } from './types';
import { AppError } from './types';

/**
 * Simple error handler registry
 */
export class SimpleErrorHandlerRegistry implements ErrorHandlerRegistry {
  private handlers: Set<ErrorHandler> = new Set();

  register(handler: ErrorHandler): void {
    this.handlers.add(handler);
  }

  unregister(handler: ErrorHandler): void {
    this.handlers.delete(handler);
  }

  handle(error: AppError | Error): void {
    // Call all registered handlers
    for (const handler of this.handlers) {
      try {
        handler(error);
      } catch (handlerError) {
        // Don't let a failing handler break other handlers
        console.error('Error in error handler:', handlerError);
      }
    }
  }
}

/**
 * Global error handler registry instance
 */
let globalRegistry: ErrorHandlerRegistry | null = null;

/**
 * Get the global error handler registry
 */
export function getGlobalErrorRegistry(): ErrorHandlerRegistry {
  if (!globalRegistry) {
    globalRegistry = new SimpleErrorHandlerRegistry();
  }
  return globalRegistry;
}

/**
 * Set the global error handler registry
 * (useful for testing or custom implementations)
 */
export function setGlobalErrorRegistry(registry: ErrorHandlerRegistry): void {
  globalRegistry = registry;
}

/**
 * Register a global error handler
 */
export function registerErrorHandler(handler: ErrorHandler): void {
  getGlobalErrorRegistry().register(handler);
}

/**
 * Unregister a global error handler
 */
export function unregisterErrorHandler(handler: ErrorHandler): void {
  getGlobalErrorRegistry().unregister(handler);
}

/**
 * Handle an error using the global registry
 */
export function handleError(error: AppError | Error): void {
  getGlobalErrorRegistry().handle(error);
}

/**
 * Wrap a function to catch and handle errors
 */
export function withErrorHandling<T extends (...args: unknown[]) => unknown>(
  fn: T,
  context?: { operation: string; component: string }
): T {
  return ((...args: unknown[]) => {
    try {
      const result = fn(...args);

      // Handle async functions
      if (result instanceof Promise) {
        return result.catch((error: Error) => {
          const appError =
            error instanceof AppError
              ? error
              : new AppError(error.message, {
                  operation: context?.operation || 'unknown',
                  component: context?.component || 'unknown',
                  recoverable: false,
                });

          handleError(appError);
          throw appError;
        });
      }

      return result;
    } catch (error) {
      const appError =
        error instanceof AppError
          ? error
          : new AppError((error as Error).message, {
              operation: context?.operation || 'unknown',
              component: context?.component || 'unknown',
              recoverable: false,
            });

      handleError(appError);
      throw appError;
    }
  }) as T;
}
