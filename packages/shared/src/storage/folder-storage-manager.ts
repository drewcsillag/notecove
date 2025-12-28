/**
 * FolderStorageManager - Manages folder tree storage using append-only logs
 *
 * Handles loading folder trees from snapshots/logs and saving updates.
 * Each SD has one folder tree (unlike notes which have one per note).
 *
 * @see STORAGE-FORMAT-DESIGN.md for specification
 */

import * as Y from 'yjs';
import { LogWriter } from './log-writer';
import { LogReader } from './log-reader';
import { SnapshotReader } from './snapshot-reader';
// VectorClockEntry used for snapshot format
import type { FileSystemAdapter } from './types';
import type { FolderSyncState } from '../database/schema';

/** Vector clock format stored in DB */
export interface VectorClock {
  [instanceId: string]: {
    sequence: number;
    offset: number;
    file: string;
  };
}

/** Folder tree paths */
export interface FolderPaths {
  logs: string;
  snapshots: string;
}

/** Result of loading a folder tree */
export interface LoadFolderTreeResult {
  doc: Y.Doc;
  vectorClock: VectorClock;
}

/** Result of saving an update */
export interface SaveUpdateResult {
  sequence: number;
  offset: number;
  file: string;
}

/** Database operations needed by FolderStorageManager */
export interface FolderSyncStateDb {
  getFolderSyncState(sdId: string): Promise<FolderSyncState | null>;
  upsertFolderSyncState(state: FolderSyncState): Promise<void>;
}

export class FolderStorageManager {
  private readonly fs: FileSystemAdapter;
  private readonly db: FolderSyncStateDb;
  private readonly profileId: string;
  private readonly instanceId: string;
  private readonly logWriters: Map<string, LogWriter> = new Map();
  private readonly sequences: Map<string, number> = new Map();

  constructor(fs: FileSystemAdapter, db: FolderSyncStateDb, profileId: string, instanceId: string) {
    this.fs = fs;
    this.db = db;
    this.profileId = profileId;
    this.instanceId = instanceId;
  }

  /**
   * Load a folder tree from storage (snapshots + logs).
   * This is the full load path - reads all files.
   */
  async loadFolderTree(sdId: string, paths: FolderPaths): Promise<LoadFolderTreeResult> {
    const doc = new Y.Doc();
    const vectorClock: VectorClock = {};

    // Try to load from snapshot
    const bestSnapshot = await SnapshotReader.findBestSnapshot(paths.snapshots, this.fs);

    if (bestSnapshot) {
      const snapshot = await SnapshotReader.readSnapshot(bestSnapshot.path, this.fs);

      // Apply snapshot state
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

    // Apply log records not covered by snapshot
    await this.applyLogRecords(doc, vectorClock, paths.logs);

    // Initialize our sequence counter from the vector clock
    this.initializeSequenceFromVectorClock(sdId, vectorClock);

    return { doc, vectorClock };
  }

  /**
   * Load a folder tree from DB cache (fast path).
   * Returns null if no cache exists.
   */
  async loadFolderTreeFromCache(
    sdId: string,
    paths: FolderPaths
  ): Promise<LoadFolderTreeResult | null> {
    const cached = await this.db.getFolderSyncState(sdId);

    if (!cached) {
      return null;
    }

    const doc = new Y.Doc();
    const vectorClock: VectorClock = JSON.parse(cached.vectorClock) as VectorClock;

    // Apply cached state
    Y.applyUpdate(doc, cached.documentState);

    // Apply any new log records since cache
    await this.applyLogRecords(doc, vectorClock, paths.logs);

    // Initialize our sequence counter from the vector clock
    this.initializeSequenceFromVectorClock(sdId, vectorClock);

    return { doc, vectorClock };
  }

  /**
   * Save an update to the log file.
   */
  async saveUpdate(
    sdId: string,
    paths: FolderPaths,
    update: Uint8Array
  ): Promise<SaveUpdateResult> {
    const writer = this.getLogWriter(sdId, paths);

    // Get next sequence number
    const sequence = (this.sequences.get(sdId) || 0) + 1;
    this.sequences.set(sdId, sequence);

    const timestamp = Date.now();
    const result = await writer.appendRecord(timestamp, sequence, update);

    return {
      sequence,
      offset: result.offset,
      file: result.file,
    };
  }

  /**
   * Save document state to database (for fast loading).
   */
  async saveDbSnapshot(sdId: string, doc: Y.Doc, vectorClock: VectorClock): Promise<void> {
    const documentState = Y.encodeStateAsUpdate(doc);

    await this.db.upsertFolderSyncState({
      sdId,
      vectorClock: JSON.stringify(vectorClock),
      documentState,
      updatedAt: Date.now(),
    });
  }

  /**
   * Get or create a LogWriter for an SD's folder tree.
   */
  getLogWriter(sdId: string, paths: FolderPaths): LogWriter {
    const existing = this.logWriters.get(sdId);
    if (existing) {
      return existing;
    }

    const writer = new LogWriter(paths.logs, this.profileId, this.instanceId, this.fs);
    this.logWriters.set(sdId, writer);
    return writer;
  }

  /**
   * Finalize all log writers.
   */
  async finalize(): Promise<void> {
    const writers = Array.from(this.logWriters.values());
    await Promise.all(writers.map((w) => w.finalize()));
    this.logWriters.clear();
  }

  /**
   * Initialize the sequence counter for a folder tree from its vector clock.
   *
   * When this instance restarts and loads an existing folder tree, the vector clock
   * shows the last sequence number we wrote. We must continue from there,
   * not start from 1, to avoid sequence violations in the CRDT system.
   */
  private initializeSequenceFromVectorClock(sdId: string, vectorClock: VectorClock): void {
    const ourEntry = vectorClock[this.instanceId];
    if (ourEntry) {
      const currentSeq = this.sequences.get(sdId) || 0;
      // Only update if the loaded sequence is higher
      if (ourEntry.sequence > currentSeq) {
        this.sequences.set(sdId, ourEntry.sequence);
        console.log(
          `[FolderStorageManager] Initialized sequence for ${sdId} to ${ourEntry.sequence} (from vector clock)`
        );
      }
    }
  }

  /**
   * Apply log records not covered by the vector clock to the document.
   */
  private async applyLogRecords(
    doc: Y.Doc,
    vectorClock: VectorClock,
    logsDir: string
  ): Promise<void> {
    const logFiles = await LogReader.listLogFiles(logsDir, this.fs);

    for (const logFile of logFiles) {
      const existingEntry = vectorClock[logFile.instanceId];

      let startOffset: number | undefined;
      let startSequence = 0;

      if (existingEntry && existingEntry.file === logFile.filename) {
        startOffset = existingEntry.offset;
        startSequence = existingEntry.sequence;
      } else if (existingEntry) {
        if (logFile.filename <= existingEntry.file) {
          continue;
        }
        startOffset = undefined;
        startSequence = 0;
      }

      let lastSequence = startSequence;
      let lastOffset = startOffset || 0;

      try {
        for await (const record of LogReader.readRecords(logFile.path, this.fs, startOffset)) {
          if (record.sequence <= startSequence) {
            continue;
          }

          Y.applyUpdate(doc, record.data);

          lastSequence = record.sequence;
          lastOffset = record.offset + record.data.length + 20;
        }
      } catch (error) {
        // Log file may be truncated (e.g., cloud sync in progress) - continue with what we got
        console.warn(
          `[FolderStorageManager] Error reading log file ${logFile.filename} (may be partially synced):`,
          error
        );
      }

      if (lastSequence > startSequence) {
        vectorClock[logFile.instanceId] = {
          sequence: lastSequence,
          offset: lastOffset,
          file: logFile.filename,
        };
      }
    }
  }
}
