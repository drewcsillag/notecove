/**
 * Console logger implementation
 * Logs to console.log/warn/error
 * Useful for testing and development
 */

import type { Logger, LogLevel, LogEntry } from './types';
import { LogLevel as LogLevelEnum } from './types';

/**
 * Console logger
 * Simple logger that outputs to console
 */
export class ConsoleLogger implements Logger {
  private currentLevel: LogLevel = LogLevelEnum.Info;

  private readonly levelPriority: Record<LogLevel, number> = {
    [LogLevelEnum.Debug]: 0,
    [LogLevelEnum.Info]: 1,
    [LogLevelEnum.Warn]: 2,
    [LogLevelEnum.Error]: 3,
  };

  constructor(level?: LogLevel) {
    if (level) {
      this.currentLevel = level;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.currentLevel];
  }

  private formatMessage(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    let message = `[${timestamp}] ${level} ${entry.message}`;

    if (entry.context && Object.keys(entry.context).length > 0) {
      message += ` ${JSON.stringify(entry.context)}`;
    }

    if (entry.error) {
      message += `\n  Error: ${entry.error.message}`;
      if (entry.error.stack) {
        message += `\n  Stack: ${entry.error.stack}`;
      }
    }

    return message;
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevelEnum.Debug)) return;

    const entry: LogEntry = {
      level: LogLevelEnum.Debug,
      message,
      timestamp: Date.now(),
      context,
    };

    console.log(this.formatMessage(entry));
  }

  info(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevelEnum.Info)) return;

    const entry: LogEntry = {
      level: LogLevelEnum.Info,
      message,
      timestamp: Date.now(),
      context,
    };

    console.log(this.formatMessage(entry));
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevelEnum.Warn)) return;

    const entry: LogEntry = {
      level: LogLevelEnum.Warn,
      message,
      timestamp: Date.now(),
      context,
    };

    console.warn(this.formatMessage(entry));
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevelEnum.Error)) return;

    const entry: LogEntry = {
      level: LogLevelEnum.Error,
      message,
      timestamp: Date.now(),
      context,
      error,
    };

    console.error(this.formatMessage(entry));
  }

  setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  getLevel(): LogLevel {
    return this.currentLevel;
  }
}
