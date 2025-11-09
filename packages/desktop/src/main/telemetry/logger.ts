/**
 * Structured Logging with OpenTelemetry Integration
 *
 * Provides a structured logger that integrates with OpenTelemetry for better observability.
 * Features:
 * - Structured log context (key-value pairs)
 * - Log levels (debug, info, warn, error)
 * - Automatic correlation with OTel traces and spans
 * - Consistent formatting across the application
 */

import { diag } from '@opentelemetry/api';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export type LogContext = Record<string, string | number | boolean | null | undefined>;

export interface LoggerOptions {
  /** Minimum log level to output */
  minLevel?: LogLevel;
  /** Prefix for all log messages from this logger */
  prefix?: string;
  /** Default context to include in all log messages */
  defaultContext?: LogContext;
}

/**
 * Structured Logger
 * Integrates with OpenTelemetry for observability
 */
export class StructuredLogger {
  private minLevel: LogLevel;
  private prefix: string;
  private defaultContext: LogContext;

  constructor(options: LoggerOptions = {}) {
    this.minLevel = options.minLevel ?? LogLevel.INFO;
    this.prefix = options.prefix ?? '';
    this.defaultContext = options.defaultContext ?? {};
  }

  /**
   * Create a child logger with additional context or prefix
   */
  child(options: { prefix?: string; context?: LogContext }): StructuredLogger {
    return new StructuredLogger({
      minLevel: this.minLevel,
      prefix: options.prefix ? `${this.prefix}${options.prefix}` : this.prefix,
      defaultContext: { ...this.defaultContext, ...options.context },
    });
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log an info message
   */
  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error, context?: LogContext): void {
    const errorContext = this.extractErrorContext(error);
    this.log(LogLevel.ERROR, message, { ...context, ...errorContext });
  }

  /**
   * Set minimum log level
   */
  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (level < this.minLevel) {
      return;
    }

    const fullContext = { ...this.defaultContext, ...context };
    const formattedMessage = this.formatMessage(level, message, fullContext);

    // Output to console
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage);
        break;
      case LogLevel.INFO:
        console.log(formattedMessage);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage);
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage);
        break;
    }

    // Also send to OTel diagnostic logger if configured
    this.sendToOTel(level, formattedMessage);
  }

  /**
   * Format log message with context
   */
  private formatMessage(level: LogLevel, message: string, context: LogContext): string {
    const levelStr = LogLevel[level];
    const timestamp = new Date().toISOString();
    const prefix = this.prefix ? `[${this.prefix}] ` : '';

    // Format context as key=value pairs
    const contextStr = Object.entries(context)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join(' ');

    if (contextStr) {
      return `${timestamp} ${levelStr} ${prefix}${message} ${contextStr}`;
    }

    return `${timestamp} ${levelStr} ${prefix}${message}`;
  }

  /**
   * Extract error context from Error object
   */
  private extractErrorContext(error?: Error): LogContext {
    if (!error) {
      return {};
    }

    return {
      error_name: error.name,
      error_message: error.message,
      error_stack: error.stack,
    };
  }

  /**
   * Send log to OpenTelemetry diagnostic logger
   */
  private sendToOTel(level: LogLevel, message: string): void {
    // Send to OTel diagnostic logger based on level
    switch (level) {
      case LogLevel.DEBUG:
        diag.debug(message);
        break;
      case LogLevel.INFO:
        diag.info(message);
        break;
      case LogLevel.WARN:
        diag.warn(message);
        break;
      case LogLevel.ERROR:
        diag.error(message);
        break;
    }
  }
}

// Global logger instance
let globalLogger: StructuredLogger | null = null;

/**
 * Get global logger instance
 */
export function getLogger(): StructuredLogger {
  globalLogger ??= new StructuredLogger({
    minLevel: process.env['NODE_ENV'] === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
  });
  return globalLogger;
}

/**
 * Create a logger with a specific prefix and context
 */
export function createLogger(prefix: string, context?: LogContext): StructuredLogger {
  if (context) {
    return getLogger().child({ prefix, context });
  }
  return getLogger().child({ prefix });
}

/**
 * Configure global logger settings
 */
export function configureLogger(options: LoggerOptions): void {
  globalLogger = new StructuredLogger(options);
}
