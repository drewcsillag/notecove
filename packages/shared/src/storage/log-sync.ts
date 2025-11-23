/**
 * LogSync - Synchronizes from other instances' log files
 *
 * Detects and reads new records from other instances' append-only logs.
 * Used for multi-instance synchronization.
 *
 * @see STORAGE-FORMAT-DESIGN.md for specification
 */

/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
// Non-null assertions required for desktop's noUncheckedIndexedAccess

import { LogReader } from './log-reader';
import type { FileSystemAdapter } from './types';

/** Callbacks for LogSync */
export interface LogSyncCallbacks {
  /** Apply a CRDT update to a note */
  applyUpdate(noteId: string, update: Uint8Array): Promise<void>;

  /** Reload a note from disk */
  reloadNote(noteId: string): Promise<void>;

  /** Get list of currently loaded note IDs */
  getLoadedNotes(): string[];
}

/** Tracking state for an instance */
interface InstanceState {
  file: string;
  sequence: number;
  offset: number;
}

/** Record with metadata */
interface RecordInfo {
  sequence: number;
  timestamp: number;
  data: Uint8Array;
  offset: number;
}

/** Result of a sync operation */
export interface SyncResult {
  /** New log files discovered */
  newFiles: string[];
  /** Total new records found */
  newRecordCount: number;
  /** Instances with updates */
  updatedInstances: string[];
}

export class LogSync {
  private readonly fs: FileSystemAdapter;
  private readonly instanceId: string;
  // TODO: Use callbacks for notifying about new records
  // private readonly callbacks: LogSyncCallbacks;

  /** Track last seen state per instance: instanceId -> { file, sequence, offset } */
  private lastSeen = new Map<string, InstanceState>();

  constructor(fs: FileSystemAdapter, instanceId: string, _callbacks: LogSyncCallbacks) {
    this.fs = fs;
    this.instanceId = instanceId;
    // this.callbacks = callbacks;
  }

  /**
   * Sync from log files in a directory.
   * Detects new log files and new records in existing files.
   *
   * @param logsDir Directory containing log files
   * @returns Sync result with counts of new files/records
   */
  async syncFromLogs(logsDir: string): Promise<SyncResult> {
    const result: SyncResult = {
      newFiles: [],
      newRecordCount: 0,
      updatedInstances: [],
    };

    // List all log files
    const logFiles = await LogReader.listLogFiles(logsDir, this.fs);

    for (const logFile of logFiles) {
      // Skip our own instance
      if (logFile.instanceId === this.instanceId) {
        continue;
      }

      const existingState = this.lastSeen.get(logFile.instanceId);

      // Check if this is a new file or existing file
      if (!existingState || existingState.file !== logFile.filename) {
        // New file (or different file from what we tracked)
        if (!existingState) {
          result.newFiles.push(logFile.filename);
        }

        // Read all records from this file
        const records = await this.readNewRecords(logFile.path, 0);

        if (records.length > 0) {
          result.newRecordCount += records.length;
          result.updatedInstances.push(logFile.instanceId);

          // Update tracking state (safe after length check)
          const lastRecord = records[records.length - 1]!;
          this.lastSeen.set(logFile.instanceId, {
            file: logFile.filename,
            sequence: lastRecord.sequence,
            offset: lastRecord.offset,
          });
        }
      } else {
        // Same file - check for new records
        const newRecords = await this.readNewRecords(logFile.path, existingState.sequence);

        if (newRecords.length > 0) {
          result.newRecordCount += newRecords.length;
          if (!result.updatedInstances.includes(logFile.instanceId)) {
            result.updatedInstances.push(logFile.instanceId);
          }

          // Update tracking state (safe after length check)
          const lastRecord = newRecords[newRecords.length - 1]!;
          this.lastSeen.set(logFile.instanceId, {
            file: logFile.filename,
            sequence: lastRecord.sequence,
            offset: lastRecord.offset,
          });
        }
      }
    }

    return result;
  }

  /**
   * Read new records from a log file starting after a given sequence.
   *
   * @param filePath Path to the log file
   * @param afterSequence Only return records with sequence > this value
   * @returns Array of new records
   */
  async readNewRecords(filePath: string, afterSequence: number): Promise<RecordInfo[]> {
    const records: RecordInfo[] = [];

    try {
      for await (const record of LogReader.readRecords(filePath, this.fs)) {
        if (record.sequence > afterSequence) {
          records.push({
            sequence: record.sequence,
            timestamp: record.timestamp,
            data: record.data,
            offset: record.offset,
          });
        }
      }
    } catch (error) {
      // Log file may be corrupted or truncated - return what we got
      console.warn(`[LogSync] Error reading ${filePath}:`, error);
    }

    return records;
  }

  /**
   * Get the current tracking state for all instances.
   */
  getLastSeenState(): Map<string, InstanceState> {
    return new Map(this.lastSeen);
  }

  /**
   * Set tracking state (for restoring from DB).
   */
  setLastSeenState(state: Map<string, InstanceState>): void {
    this.lastSeen = new Map(state);
  }

  /**
   * Reset all tracking state.
   */
  reset(): void {
    this.lastSeen.clear();
  }

  /**
   * Export state as serializable object.
   */
  exportState(): Record<string, InstanceState> {
    const obj: Record<string, InstanceState> = {};
    for (const [key, value] of this.lastSeen) {
      obj[key] = value;
    }
    return obj;
  }

  /**
   * Import state from serializable object.
   */
  importState(obj: Record<string, InstanceState>): void {
    this.lastSeen.clear();
    for (const [key, value] of Object.entries(obj)) {
      this.lastSeen.set(key, value);
    }
  }
}
