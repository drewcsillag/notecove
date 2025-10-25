/**
 * Logging abstraction types
 * Platform-specific implementations (Node.js, iOS) must implement these interfaces
 */

/**
 * Log levels
 */
export enum LogLevel {
  Debug = 'debug',
  Info = 'info',
  Warn = 'warn',
  Error = 'error',
}

/**
 * Log entry
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  context?: Record<string, unknown>;
  error?: Error;
}

/**
 * Logger interface
 * Platform-specific implementations handle actual logging
 */
export interface Logger {
  /**
   * Log a debug message
   */
  debug(message: string, context?: Record<string, unknown>): void;

  /**
   * Log an info message
   */
  info(message: string, context?: Record<string, unknown>): void;

  /**
   * Log a warning
   */
  warn(message: string, context?: Record<string, unknown>): void;

  /**
   * Log an error
   */
  error(message: string, error?: Error, context?: Record<string, unknown>): void;

  /**
   * Set minimum log level
   */
  setLevel(level: LogLevel): void;

  /**
   * Get current log level
   */
  getLevel(): LogLevel;
}

/**
 * Error context for structured error information
 */
export interface ErrorContext {
  /**
   * Operation being performed when error occurred
   */
  operation: string;

  /**
   * Component or module where error occurred
   */
  component: string;

  /**
   * Additional context data
   */
  data?: Record<string, unknown>;

  /**
   * Whether this error is recoverable
   */
  recoverable?: boolean;
}

/**
 * Application error with structured context
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly context: ErrorContext,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'AppError';

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * Convert to plain object for logging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      context: this.context,
      cause: this.cause
        ? {
            name: this.cause.name,
            message: this.cause.message,
            stack: this.cause.stack,
          }
        : undefined,
      stack: this.stack,
    };
  }
}

/**
 * Error categories for easier handling
 */
export enum ErrorCategory {
  /** File system operations (read, write, watch) */
  FileSystem = 'filesystem',

  /** CRDT operations (merge, apply update) */
  CRDT = 'crdt',

  /** Database operations (query, index) */
  Database = 'database',

  /** Network/sync operations */
  Sync = 'sync',

  /** User input validation */
  Validation = 'validation',

  /** Unknown/unexpected errors */
  Unknown = 'unknown',
}

/**
 * Error handler function
 */
export type ErrorHandler = (error: AppError | Error) => void;

/**
 * Global error handling registry
 */
export interface ErrorHandlerRegistry {
  /**
   * Register an error handler
   */
  register(handler: ErrorHandler): void;

  /**
   * Unregister an error handler
   */
  unregister(handler: ErrorHandler): void;

  /**
   * Handle an error (calls all registered handlers)
   */
  handle(error: AppError | Error): void;
}
