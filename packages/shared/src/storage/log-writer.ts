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
  decodeVarint,
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
  private readonly profileId: string;
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
    profileId: string,
    instanceId: string,
    fs: FileSystemAdapter,
    options: LogWriterOptions = {}
  ) {
    this.logDir = logDir;
    this.profileId = profileId;
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
   * Initialize the writer.
   * Tries to append to an existing file first, otherwise creates a new one.
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    // Ensure log directory exists
    if (!(await this.fs.exists(this.logDir))) {
      await this.fs.mkdir(this.logDir);
    }

    // Try to find an existing file we can append to
    const existingFile = await this.findAppendableFile();
    if (existingFile) {
      this.currentFile = existingFile.path;
      this.currentOffset = existingFile.appendOffset;
      console.log(
        `[LogWriter] Appending to existing file: ${this.fs.basename(existingFile.path)} at offset ${existingFile.appendOffset}`
      );
    }
    // If no appendable file found, a new one will be created on first write

    this.initialized = true;
  }

  /**
   * Find an existing file that can be appended to.
   * Returns the most recent file for this profile+instance that hasn't been finalized.
   */
  private async findAppendableFile(): Promise<{ path: string; appendOffset: number } | null> {
    const files = await this.fs.listFiles(this.logDir);

    // Match both old format (instanceId_timestamp.crdtlog) and
    // new format (profileId_instanceId_timestamp.crdtlog)
    const matchingFiles: { filename: string; timestamp: number }[] = [];

    for (const filename of files) {
      if (!filename.endsWith('.crdtlog')) continue;

      // Try new format: {profileId}_{instanceId}_{timestamp}.crdtlog
      const newMatch = filename.match(/^(.+)_(.+)_(\d+)\.crdtlog$/);
      if (newMatch) {
        const [, fileProfileId, fileInstanceId, ts] = newMatch;
        if (fileProfileId === this.profileId && fileInstanceId === this.instanceId) {
          matchingFiles.push({ filename, timestamp: parseInt(ts!, 10) });
          continue;
        }
      }

      // Try old format: {instanceId}_{timestamp}.crdtlog (for backward compat)
      const oldMatch = filename.match(/^(.+)_(\d+)\.crdtlog$/);
      if (oldMatch) {
        const [, fileInstanceId, ts] = oldMatch;
        if (fileInstanceId === this.instanceId) {
          matchingFiles.push({ filename, timestamp: parseInt(ts!, 10) });
        }
      }
    }

    if (matchingFiles.length === 0) return null;

    // Sort by timestamp descending, check the most recent one
    matchingFiles.sort((a, b) => b.timestamp - a.timestamp);

    for (const { filename } of matchingFiles) {
      const filePath = this.fs.joinPath(this.logDir, filename);
      const appendOffset = await this.validateAndGetAppendOffset(filePath);
      if (appendOffset !== null) {
        return { path: filePath, appendOffset };
      }
    }

    return null;
  }

  /**
   * Validate a log file and determine where to append.
   * Returns the append offset, or null if the file can't be appended to
   * (e.g., it has a termination sentinel or is corrupt).
   *
   * Log record format:
   * - varint: length of (timestamp + sequence + data)
   * - 8 bytes: timestamp (big-endian)
   * - varint: sequence number
   * - N bytes: data
   *
   * Termination sentinel is length=0 (single byte: 0x00).
   */
  private async validateAndGetAppendOffset(filePath: string): Promise<number | null> {
    try {
      const content = await this.fs.readFile(filePath);
      if (content.length < LOG_HEADER_SIZE) {
        return null; // Too small to be valid
      }

      // Scan through the file to find the end of valid records
      let offset = LOG_HEADER_SIZE;

      while (offset < content.length) {
        try {
          // Read length prefix (varint)
          const lengthResult = decodeVarint(content, offset);
          const payloadLength = lengthResult.value;

          // Check for termination sentinel (length=0)
          if (payloadLength === 0) {
            // File has been finalized, can't append
            return null;
          }

          // Check if we have enough bytes for the full record
          const recordTotalSize = lengthResult.bytesRead + payloadLength;
          if (offset + recordTotalSize > content.length) {
            // Incomplete record at end (crash during write) - append here
            break;
          }

          offset += recordTotalSize;
        } catch {
          // Varint decode failed - file may be corrupt, stop here
          break;
        }
      }

      // Check if file is at rotation size
      if (offset >= this.rotationSize) {
        return null; // File is at rotation size, create new one
      }

      return offset;
    } catch {
      return null; // File can't be read
    }
  }

  /**
   * Create a new log file with header.
   * Uses new format: {profileId}_{instanceId}_{timestamp}.crdtlog
   */
  private async createNewFile(): Promise<void> {
    const timestamp = await this.getUniqueTimestamp();
    const filename = `${this.profileId}_${this.instanceId}_${timestamp}.crdtlog`;
    this.currentFile = this.fs.joinPath(this.logDir, filename);

    // Write header
    const header = writeLogHeader();
    await this.fs.writeFile(this.currentFile, header);
    this.currentOffset = LOG_HEADER_SIZE;

    console.log(`[LogWriter] Created new log file: ${filename}`);
  }

  /**
   * Get a unique timestamp for the filename, handling collisions.
   */
  private async getUniqueTimestamp(): Promise<number> {
    let timestamp = Date.now();

    // Check for existing files with this profile+instance ID
    const files = await this.fs.listFiles(this.logDir);
    const prefix = `${this.profileId}_${this.instanceId}_`;
    const ourFiles = files
      .filter((f) => f.startsWith(prefix) && f.endsWith('.crdtlog'))
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
