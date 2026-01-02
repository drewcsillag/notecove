/**
 * Example Usage of Structured Logger
 *
 * This file demonstrates how to use the structured logger throughout the application.
 * Delete this file after reviewing the examples.
 */

import { createLogger, LogLevel, configureLogger } from './logger';

// Example 1: Basic usage with prefix
const crdtLogger = createLogger('CRDT Manager');

function loadNote(noteId: string) {
  crdtLogger.info('Loading note from disk', {
    note_id: noteId,
    operation: 'cold_load',
  });

  try {
    // ... load note logic ...
    crdtLogger.info('Note loaded successfully', {
      note_id: noteId,
      duration_ms: 150,
    });
  } catch (error) {
    crdtLogger.error('Failed to load note', error as Error, {
      note_id: noteId,
    });
  }
}

// Example 2: Child logger with additional context
const snapshotLogger = crdtLogger.child({
  prefix: ':Snapshot',
  context: { sd_id: 'default' },
});

function createSnapshot(noteId: string) {
  const startTime = Date.now();

  snapshotLogger.info('Creating snapshot', { note_id: noteId });

  try {
    // ... snapshot creation logic ...
    const duration = Date.now() - startTime;

    snapshotLogger.info('Snapshot created', {
      note_id: noteId,
      duration_ms: duration,
      file_count: 42,
    });
  } catch (error) {
    snapshotLogger.error('Snapshot creation failed', error as Error, {
      note_id: noteId,
    });
  }
}

// Example 3: Different log levels
const debugLogger = createLogger('Debug Example');

function demonstrateLogLevels() {
  debugLogger.debug('This is a debug message', {
    detail_level: 'verbose',
  });

  debugLogger.info('This is an info message', {
    user_action: 'note_created',
  });

  debugLogger.warn('This is a warning', {
    threshold_exceeded: true,
    current_value: 100,
    max_value: 80,
  });

  debugLogger.error('This is an error', new Error('Something went wrong'), {
    recovery_attempted: false,
  });
}

// Example 4: Configure global logger
function initializeLogging() {
  configureLogger({
    minLevel: process.env['NODE_ENV'] === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
    defaultContext: {
      app_version: '0.2.1',
      environment: process.env['NODE_ENV'] ?? 'development',
    },
  });
}

// Example output format:
// 2025-11-05T07:00:00.000Z INFO [CRDT Manager] Loading note from disk note_id="abc-123" operation="cold_load"
// 2025-11-05T07:00:00.150Z INFO [CRDT Manager] Note loaded successfully note_id="abc-123" duration_ms=150
// 2025-11-05T07:00:00.000Z INFO [CRDT Manager:Snapshot] Creating snapshot note_id="abc-123" sd_id="default"
// 2025-11-05T07:00:00.200Z INFO [CRDT Manager:Snapshot] Snapshot created note_id="abc-123" sd_id="default" duration_ms=200 file_count=42
// 2025-11-05T07:00:00.000Z ERROR [CRDT Manager:Snapshot] Snapshot creation failed note_id="abc-123" sd_id="default" error_name="Error" error_message="Something went wrong" error_stack="..."

export { loadNote, createSnapshot, demonstrateLogLevels, initializeLogging };
