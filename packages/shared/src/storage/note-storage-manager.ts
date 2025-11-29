/**
 * NoteStorageManager - Manages note storage using append-only logs
 *
 * Handles loading notes from snapshots/logs and saving updates.
 * Uses LogWriter for append-only writes and maintains DB snapshots for fast loading.
 *
 * @see STORAGE-FORMAT-DESIGN.md for specification
 */

import * as Y from 'yjs';
import { LogWriter } from './log-writer';
import { LogReader } from './log-reader';
import { SnapshotReader } from './snapshot-reader';
import type { FileSystemAdapter } from './types';
import type { NoteSyncState } from '../database/schema';

/** Paths needed for note storage operations */
export interface NoteLogPaths {
  logs: string;
  snapshots: string;
}

/** Vector clock format stored in DB */
export interface VectorClock {
  [instanceId: string]: {
    sequence: number;
    offset: number;
    file: string;
  };
}

/** Result of loading a note */
export interface LoadNoteResult {
  doc: Y.Doc;
  vectorClock: VectorClock;
}

/** Result of saving an update */
export interface SaveUpdateResult {
  sequence: number;
  offset: number;
  file: string;
}

/** Database operations needed by NoteStorageManager */
export interface NoteSyncStateDb {
  getNoteSyncState(noteId: string, sdId: string): Promise<NoteSyncState | null>;
  upsertNoteSyncState(state: NoteSyncState): Promise<void>;
}

export class NoteStorageManager {
  private readonly fs: FileSystemAdapter;
  private readonly db: NoteSyncStateDb;
  private readonly instanceId: string;
  private readonly logWriters: Map<string, LogWriter> = new Map();
  private readonly sequences: Map<string, number> = new Map();
  // Write queues to serialize writes per note and prevent out-of-order records
  private readonly writeQueues: Map<string, Promise<SaveUpdateResult>> = new Map();

  constructor(fs: FileSystemAdapter, db: NoteSyncStateDb, instanceId: string) {
    this.fs = fs;
    this.db = db;
    this.instanceId = instanceId;
  }

  /**
   * Load a note from storage (snapshots + logs).
   * This is the full load path - reads all files.
   *
   * Algorithm:
   * 1. Find best snapshot (most recent complete)
   * 2. Load snapshot state and vector clock
   * 3. Find all log files
   * 4. Apply log records not covered by snapshot vector clock
   * 5. Initialize our sequence counter from vector clock
   * 6. Return merged doc and updated vector clock
   */
  async loadNote(sdId: string, noteId: string, paths: NoteLogPaths): Promise<LoadNoteResult> {
    console.log(`[NoteStorageManager] loadNote called, logs path: ${paths.logs}`);
    const doc = new Y.Doc();
    const vectorClock: VectorClock = {};

    // Step 1: Try to load from snapshot
    const bestSnapshot = await SnapshotReader.findBestSnapshot(paths.snapshots, this.fs);
    console.log(`[NoteStorageManager] Best snapshot: ${bestSnapshot ? bestSnapshot.path : 'none'}`);

    if (bestSnapshot) {
      const snapshot = await SnapshotReader.readSnapshot(bestSnapshot.path, this.fs);

      // Apply snapshot state to doc
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

    // Step 2: Apply log records not covered by snapshot
    await this.applyLogRecords(doc, vectorClock, paths.logs);

    // Step 3: Initialize our sequence counter from the vector clock
    // This ensures we continue from where we left off after app restart
    this.initializeSequenceFromVectorClock(sdId, noteId, vectorClock);

    return { doc, vectorClock };
  }

  /**
   * Load a note from DB cache (fast path).
   * If cache exists, loads cached state and applies any new log records.
   *
   * @returns LoadNoteResult if cache exists, null otherwise
   */
  async loadNoteFromCache(
    sdId: string,
    noteId: string,
    paths: NoteLogPaths
  ): Promise<LoadNoteResult | null> {
    // Try to get cached state from DB
    const cached = await this.db.getNoteSyncState(noteId, sdId);

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
    // This ensures we continue from where we left off after app restart
    this.initializeSequenceFromVectorClock(sdId, noteId, vectorClock);

    return { doc, vectorClock };
  }

  /**
   * Save an update to the log file.
   * Creates/appends to the current log file for this note.
   *
   * Uses a queue to serialize writes per note, ensuring records are written
   * in sequence order even when multiple updates arrive concurrently.
   */
  async saveUpdate(
    sdId: string,
    noteId: string,
    paths: NoteLogPaths,
    update: Uint8Array
  ): Promise<SaveUpdateResult> {
    const queueKey = `${sdId}:${noteId}`;

    // Chain this write after any pending writes for this note
    const previousWrite = this.writeQueues.get(queueKey) ?? Promise.resolve({} as SaveUpdateResult);

    const writePromise = previousWrite.then(async () => {
      const writer = this.getLogWriter(noteId, paths);

      // Get next sequence number
      const seqKey = `${sdId}:${noteId}`;
      const sequence = (this.sequences.get(seqKey) || 0) + 1;
      this.sequences.set(seqKey, sequence);

      const timestamp = Date.now();
      const result = await writer.appendRecord(timestamp, sequence, update);

      return {
        sequence,
        offset: result.offset,
        file: result.file,
      };
    });

    // Store this write as the new tail of the queue
    this.writeQueues.set(queueKey, writePromise);

    // Clean up the queue entry after completion to prevent memory leak
    void writePromise.finally(() => {
      if (this.writeQueues.get(queueKey) === writePromise) {
        this.writeQueues.delete(queueKey);
      }
    });

    return writePromise;
  }

  /**
   * Save document state to database (for fast loading).
   */
  async saveDbSnapshot(
    sdId: string,
    noteId: string,
    encodedState: Uint8Array,
    vectorClock: VectorClock
  ): Promise<void> {
    await this.db.upsertNoteSyncState({
      noteId,
      sdId,
      vectorClock: JSON.stringify(vectorClock),
      documentState: encodedState,
      updatedAt: Date.now(),
    });
  }

  /**
   * Get or create a LogWriter for a note.
   */
  getLogWriter(noteId: string, paths: NoteLogPaths): LogWriter {
    const existing = this.logWriters.get(noteId);
    if (existing) {
      return existing;
    }

    const writer = new LogWriter(paths.logs, this.instanceId, this.fs);
    this.logWriters.set(noteId, writer);
    return writer;
  }

  /**
   * Finalize all log writers (write termination sentinels).
   * Call this when shutting down or switching notes.
   */
  async finalize(): Promise<void> {
    const writers = Array.from(this.logWriters.values());
    await Promise.all(writers.map((w) => w.finalize()));
    this.logWriters.clear();
  }

  /**
   * Initialize the sequence counter for a note from its vector clock.
   *
   * When this instance restarts and loads an existing note, the vector clock
   * shows the last sequence number we wrote. We must continue from there,
   * not start from 1, to avoid sequence violations in the CRDT system.
   *
   * This is critical when using stable instanceIds (like profile IDs) that
   * persist across app restarts.
   */
  private initializeSequenceFromVectorClock(
    sdId: string,
    noteId: string,
    vectorClock: VectorClock
  ): void {
    const ourEntry = vectorClock[this.instanceId];
    if (ourEntry) {
      const seqKey = `${sdId}:${noteId}`;
      const currentSeq = this.sequences.get(seqKey) || 0;
      // Only update if the loaded sequence is higher
      if (ourEntry.sequence > currentSeq) {
        this.sequences.set(seqKey, ourEntry.sequence);
        console.log(
          `[NoteStorageManager] Initialized sequence for ${seqKey} to ${ourEntry.sequence} (from vector clock)`
        );
      }
    }
  }

  /**
   * Apply log records not covered by the vector clock to the document.
   * Updates vectorClock in place.
   */
  private async applyLogRecords(
    doc: Y.Doc,
    vectorClock: VectorClock,
    logsDir: string
  ): Promise<void> {
    // List all log files
    const logFiles = await LogReader.listLogFiles(logsDir, this.fs);

    console.log(
      `[NoteStorageManager] applyLogRecords: Found ${logFiles.length} log files in ${logsDir}`
    );
    console.log(`[NoteStorageManager] Vector clock:`, JSON.stringify(vectorClock));

    for (const logFile of logFiles) {
      console.log(
        `[NoteStorageManager] Processing log file: ${logFile.filename} (instanceId: ${logFile.instanceId})`
      );
      const existingEntry = vectorClock[logFile.instanceId];
      console.log(`[NoteStorageManager] Existing entry for ${logFile.instanceId}:`, existingEntry);

      // Determine where to start reading
      let startOffset: number | undefined;
      let startSequence = 0;

      if (existingEntry && existingEntry.file === logFile.filename) {
        // Same file - start after last read position
        startOffset = existingEntry.offset;
        startSequence = existingEntry.sequence;
      } else if (existingEntry) {
        // Different file - check if this file is newer
        // (filename contains timestamp, so lexicographic comparison works)
        if (logFile.filename <= existingEntry.file) {
          // This file is older or same, skip entirely
          continue;
        }
        // Newer file, read from beginning
        startOffset = undefined;
        startSequence = 0;
      }

      // Read and apply records
      // Use try/catch to handle truncated files gracefully (e.g., during cloud sync)
      // Track max sequence seen (not last read) since records may be out-of-order
      // due to iCloud sync merging files from different instances
      let maxSequence = startSequence;
      let lastOffset = startOffset || 0;

      try {
        let recordCount = 0;
        for await (const record of LogReader.readRecords(logFile.path, this.fs, startOffset)) {
          recordCount++;
          // Skip records we've already seen (by sequence)
          if (record.sequence <= startSequence) {
            console.log(
              `[NoteStorageManager] Skipping record ${record.sequence} (already seen, startSequence=${startSequence})`
            );
            continue;
          }

          console.log(
            `[NoteStorageManager] Applying record ${record.sequence} from ${logFile.filename}, data size: ${record.data.length}`
          );
          // Apply update to doc
          Y.applyUpdate(doc, record.data);

          // Track the highest sequence seen and the furthest offset read
          if (record.sequence > maxSequence) {
            maxSequence = record.sequence;
          }
          lastOffset = record.offset + record.bytesRead;
        }
        console.log(
          `[NoteStorageManager] Read ${recordCount} total records from ${logFile.filename}`
        );
      } catch (error) {
        // Log file may be truncated (e.g., cloud sync in progress)
        // Throw the error so ActivitySync can retry with exponential backoff
        const errorMessage = (error as Error).message || '';
        if (
          errorMessage.includes('Truncated record') ||
          errorMessage.includes('Truncated header')
        ) {
          console.warn(
            `[NoteStorageManager] Truncated log file ${logFile.filename} (cloud sync in progress), will retry:`,
            errorMessage
          );
          throw error; // Throw to trigger retry in ActivitySync
        }
        // For other errors, log and continue with what we got
        console.warn(`[NoteStorageManager] Error reading log file ${logFile.filename}:`, error);
      }

      console.log(
        `[NoteStorageManager] maxSequence=${maxSequence}, startSequence=${startSequence}`
      );
      // Update vector clock if we read any new records
      if (maxSequence > startSequence) {
        vectorClock[logFile.instanceId] = {
          sequence: maxSequence,
          offset: lastOffset,
          file: logFile.filename,
        };
      }
    }
  }
}
