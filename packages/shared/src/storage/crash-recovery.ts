/**
 * CrashRecovery - Handles recovery from crashes and cleanup
 *
 * Provides methods for:
 * - Cleaning up incomplete snapshots
 * - Cleaning up old snapshots and logs
 * - Validating log file integrity
 * - Recovering documents from storage
 *
 * @see STORAGE-FORMAT-DESIGN.md for specification
 */

import * as Y from 'yjs';
import { SnapshotReader } from './snapshot-reader';
import { LogReader } from './log-reader';
import type { FileSystemAdapter } from './types';

/** Vector clock format */
interface VectorClock {
  [instanceId: string]: {
    sequence: number;
    offset: number;
    file: string;
  };
}

/** Result of document recovery */
export interface RecoverDocumentResult {
  doc: Y.Doc;
  vectorClock: VectorClock;
}

/** Result of log validation */
export interface LogValidationResult {
  valid: boolean;
  recordCount: number;
  error?: string;
}

export class CrashRecovery {
  private readonly fs: FileSystemAdapter;

  constructor(fs: FileSystemAdapter) {
    this.fs = fs;
  }

  /**
   * Clean up incomplete snapshots (status != 0x01).
   * These are snapshots where the write was interrupted before completion.
   *
   * @param snapshotDir Directory containing snapshots
   * @returns Array of deleted file paths
   */
  async cleanupIncompleteSnapshots(snapshotDir: string): Promise<string[]> {
    const deleted: string[] = [];
    const files = await SnapshotReader.listSnapshotFiles(snapshotDir, this.fs);

    for (const file of files) {
      const isComplete = await SnapshotReader.isComplete(file.path, this.fs);
      if (!isComplete) {
        await this.fs.deleteFile(file.path);
        deleted.push(file.path);
      }
    }

    return deleted;
  }

  /**
   * Clean up old snapshots, keeping only the most recent N.
   *
   * @param snapshotDir Directory containing snapshots
   * @param keepCount Number of snapshots to keep
   * @returns Array of deleted file paths
   */
  async cleanupOldSnapshots(snapshotDir: string, keepCount: number): Promise<string[]> {
    const deleted: string[] = [];
    const files = await SnapshotReader.listSnapshotFiles(snapshotDir, this.fs);

    // Files are already sorted by timestamp descending (newest first)
    // Delete all but the newest keepCount
    const toDelete = files.slice(keepCount);

    for (const file of toDelete) {
      await this.fs.deleteFile(file.path);
      deleted.push(file.path);
    }

    return deleted;
  }

  /**
   * Clean up log files that are no longer needed.
   * Logs are safe to delete if:
   * 1. A complete snapshot exists that covers them
   * 2. The snapshot's vector clock shows they were fully processed
   *
   * @param snapshotDir Directory containing snapshots
   * @param logsDir Directory containing logs
   * @returns Array of deleted file paths
   */
  async cleanupOldLogs(snapshotDir: string, logsDir: string): Promise<string[]> {
    const deleted: string[] = [];

    // Find the best snapshot
    const bestSnapshot = await SnapshotReader.findBestSnapshot(snapshotDir, this.fs);
    if (!bestSnapshot) {
      // No snapshot, can't safely delete logs
      return deleted;
    }

    // Read the snapshot to get its vector clock
    const snapshot = await SnapshotReader.readSnapshot(bestSnapshot.path, this.fs);

    // Build map of instance -> oldest safe file
    const safeFiles = new Map<string, string>();
    for (const entry of snapshot.vectorClock) {
      safeFiles.set(entry.instanceId, entry.filename);
    }

    // List all log files
    const logFiles = await LogReader.listLogFiles(logsDir, this.fs);

    for (const logFile of logFiles) {
      const safeFile = safeFiles.get(logFile.instanceId);

      if (safeFile) {
        // This instance is in the vector clock
        // Safe to delete files older than the referenced file
        if (logFile.filename < safeFile) {
          await this.fs.deleteFile(logFile.path);
          deleted.push(logFile.path);
        }
      }
      // If instance not in vector clock, keep the file (could be from another instance)
    }

    return deleted;
  }

  /**
   * Validate the integrity of a log file.
   *
   * @param logPath Path to the log file
   * @returns Validation result with record count and any errors
   */
  async validateLogIntegrity(logPath: string): Promise<LogValidationResult> {
    try {
      // Validate header first
      const headerResult = await LogReader.validateHeader(logPath, this.fs);
      if (!headerResult.valid) {
        return {
          valid: false,
          recordCount: 0,
          error: headerResult.error ?? 'Unknown header error',
        };
      }

      // Try to read all records
      let recordCount = 0;
      try {
        for await (const _ of LogReader.readRecords(logPath, this.fs)) {
          void _; // suppress unused variable warning
          recordCount++;
        }
      } catch (error) {
        // Some records may be valid before corruption
        // This is okay - we return the count of valid records
        if (recordCount === 0) {
          return {
            valid: false,
            recordCount: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      }

      return {
        valid: true,
        recordCount,
      };
    } catch (error) {
      return {
        valid: false,
        recordCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Recover a document from snapshots and logs.
   * This is the full recovery path - reads all available data.
   *
   * @param snapshotDir Directory containing snapshots
   * @param logsDir Directory containing logs
   * @returns Recovered document and vector clock, or null if no data
   */
  async recoverDocument(
    snapshotDir: string,
    logsDir: string
  ): Promise<RecoverDocumentResult | null> {
    const doc = new Y.Doc();
    const vectorClock: VectorClock = {};

    // Try to load from best snapshot
    const bestSnapshot = await SnapshotReader.findBestSnapshot(snapshotDir, this.fs);

    if (bestSnapshot) {
      const snapshot = await SnapshotReader.readSnapshot(bestSnapshot.path, this.fs);
      Y.applyUpdate(doc, snapshot.documentState);

      // Build vector clock from snapshot
      for (const entry of snapshot.vectorClock) {
        vectorClock[entry.instanceId] = {
          sequence: entry.sequence,
          offset: entry.offset,
          file: entry.filename,
        };
      }
    }

    // Apply all log records not covered by snapshot
    const logFiles = await LogReader.listLogFiles(logsDir, this.fs);
    let hasData = bestSnapshot !== null;

    for (const logFile of logFiles) {
      const existingEntry = vectorClock[logFile.instanceId];

      let startSequence = 0;

      if (existingEntry) {
        if (logFile.filename < existingEntry.file) {
          // This file is fully covered by snapshot
          continue;
        } else if (logFile.filename === existingEntry.file) {
          // Same file, start after covered sequence
          startSequence = existingEntry.sequence;
        }
        // Newer file, read from beginning
      }

      let lastSequence = startSequence;

      for await (const record of LogReader.readRecords(logFile.path, this.fs)) {
        if (record.sequence <= startSequence) {
          continue;
        }

        Y.applyUpdate(doc, record.data);
        lastSequence = record.sequence;
        hasData = true;
      }

      if (lastSequence > startSequence) {
        vectorClock[logFile.instanceId] = {
          sequence: lastSequence,
          offset: 0, // We don't track exact offset during recovery
          file: logFile.filename,
        };
      }
    }

    if (!hasData) {
      return null;
    }

    return { doc, vectorClock };
  }
}
