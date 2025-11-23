/**
 * LogWriter - Append-only CRDT log file writer
 *
 * Handles writing records to .crdtlog files with automatic rotation at size limit.
 *
 * @see STORAGE-FORMAT-DESIGN.md for specification
 */

/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
// Non-null assertions required for desktop's noUncheckedIndexedAccess

import {
  writeLogHeader,
  writeLogRecord,
  writeTerminationSentinel,
  LOG_HEADER_SIZE,
} from './binary-format';
import type { FileSystemAdapter } from './types';

/** Default rotation size: 10 MB */
const DEFAULT_ROTATION_SIZE = 10 * 1024 * 1024;

export interface LogWriterOptions {
  /** Size in bytes at which to rotate to a new file (default: 10MB) */
  rotationSizeBytes?: number;
  /** Callback invoked when log rotation occurs (for snapshot creation) */
  onRotate?: () => Promise<void>;
}

export interface AppendResult {
  /** Full path to the log file */
  file: string;
  /** Byte offset where record was written */
  offset: number;
}

export class LogWriter {
  private readonly logDir: string;
  private readonly instanceId: string;
  private readonly fs: FileSystemAdapter;
  private readonly rotationSize: number;
  private readonly onRotate: (() => Promise<void>) | undefined;

  private currentFile: string | null = null;
  private currentOffset = 0;
  private finalized = false;
  private initialized = false;

  constructor(
    logDir: string,
    instanceId: string,
    fs: FileSystemAdapter,
    options: LogWriterOptions = {}
  ) {
    this.logDir = logDir;
    this.instanceId = instanceId;
    this.fs = fs;
    this.rotationSize = options.rotationSizeBytes ?? DEFAULT_ROTATION_SIZE;
    this.onRotate = options.onRotate;
  }

  /**
   * Append a record to the current log file.
   *
   * @param timestamp - Unix milliseconds when change was made
   * @param sequence - Per-instance sequence number
   * @param data - Raw Yjs update data
   * @returns File path and byte offset where record was written
   */
  async appendRecord(timestamp: number, sequence: number, data: Uint8Array): Promise<AppendResult> {
    if (this.finalized) {
      throw new Error('Cannot append to finalized log writer');
    }

    // Initialize on first write
    if (!this.initialized) {
      await this.initialize();
    }

    // Check if we need to rotate before writing
    const record = writeLogRecord(timestamp, sequence, data);
    if (this.currentOffset + record.length > this.rotationSize) {
      await this.rotate();
    }

    // Ensure we have a current file
    if (!this.currentFile) {
      await this.createNewFile();
    }

    // Record the offset before appending
    const recordOffset = this.currentOffset;

    // Append the record
    await this.fs.appendFile(this.currentFile!, record);
    this.currentOffset += record.length;

    return {
      file: this.fs.basename(this.currentFile!),
      offset: recordOffset,
    };
  }

  /**
   * Finalize the log file by writing termination sentinel.
   * No more records can be written after finalization.
   */
  async finalize(): Promise<void> {
    if (this.finalized) {
      return; // Idempotent
    }

    if (this.currentFile) {
      const sentinel = writeTerminationSentinel();
      await this.fs.appendFile(this.currentFile, sentinel);
      this.currentOffset += sentinel.length;
    }

    this.finalized = true;
  }

  /**
   * Get the current log file path.
   */
  getCurrentFile(): string | null {
    return this.currentFile;
  }

  /**
   * Get the current byte offset in the log file.
   */
  getCurrentOffset(): number {
    return this.currentOffset;
  }

  /**
   * Initialize the writer (ensure directory exists).
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    // Ensure log directory exists
    if (!(await this.fs.exists(this.logDir))) {
      await this.fs.mkdir(this.logDir);
    }

    this.initialized = true;
  }

  /**
   * Create a new log file with header.
   */
  private async createNewFile(): Promise<void> {
    const timestamp = await this.getUniqueTimestamp();
    const filename = `${this.instanceId}_${timestamp}.crdtlog`;
    this.currentFile = this.fs.joinPath(this.logDir, filename);

    // Write header
    const header = writeLogHeader();
    await this.fs.writeFile(this.currentFile, header);
    this.currentOffset = LOG_HEADER_SIZE;
  }

  /**
   * Get a unique timestamp for the filename, handling collisions.
   */
  private async getUniqueTimestamp(): Promise<number> {
    let timestamp = Date.now();

    // Check for existing files with this instance ID
    const files = await this.fs.listFiles(this.logDir);
    const ourFiles = files
      .filter((f) => f.startsWith(`${this.instanceId}_`) && f.endsWith('.crdtlog'))
      .map((f) => {
        const match = f.match(/_(\d+)\.crdtlog$/);
        return match ? parseInt(match[1]!, 10) : 0;
      })
      .filter((t) => t > 0);

    if (ourFiles.length > 0) {
      const maxTimestamp = Math.max(...ourFiles);
      if (timestamp <= maxTimestamp) {
        timestamp = maxTimestamp + 1;
      }
    }

    return timestamp;
  }

  /**
   * Rotate to a new log file.
   */
  private async rotate(): Promise<void> {
    // Finalize current file
    if (this.currentFile) {
      const sentinel = writeTerminationSentinel();
      await this.fs.appendFile(this.currentFile, sentinel);
    }

    // Create new file
    await this.createNewFile();

    // Notify listener
    if (this.onRotate) {
      await this.onRotate();
    }
  }
}
