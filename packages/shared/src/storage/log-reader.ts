/**
 * LogReader - CRDT log file reader
 *
 * Provides static methods for reading and listing .crdtlog files.
 *
 * @see STORAGE-FORMAT-DESIGN.md for specification
 */

/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
// Non-null assertions required for desktop's noUncheckedIndexedAccess

import { readLogHeader, readLogRecord, LOG_HEADER_SIZE } from './binary-format';
import type { FileSystemAdapter } from './types';

/** Information about a log file */
export interface LogFileInfo {
  /** Filename only (not full path) */
  filename: string;
  /** Full path to the file */
  path: string;
  /** Instance ID extracted from filename */
  instanceId: string;
  /** Creation timestamp extracted from filename */
  timestamp: number;
  /** File size in bytes */
  size: number;
}

/** Record read from a log file with position metadata */
export interface LogRecordWithOffset {
  /** Unix milliseconds when change was made */
  timestamp: number;
  /** Per-instance sequence number */
  sequence: number;
  /** Raw Yjs update data */
  data: Uint8Array;
  /** Byte offset where this record starts in the file */
  offset: number;
  /** Total bytes consumed for this record (use offset + bytesRead for next record position) */
  bytesRead: number;
}

export class LogReader {
  /**
   * List all .crdtlog files in a directory, sorted by timestamp.
   *
   * @param logDir - Directory to scan
   * @param fs - File system adapter
   * @returns Array of log file info, sorted by timestamp ascending
   */
  static async listLogFiles(logDir: string, fs: FileSystemAdapter): Promise<LogFileInfo[]> {
    let files: string[];
    try {
      files = await fs.listFiles(logDir);
    } catch {
      return [];
    }

    const logFiles: LogFileInfo[] = [];

    for (const filename of files) {
      if (!filename.endsWith('.crdtlog')) continue;

      // Parse filename: {instanceId}_{timestamp}.crdtlog
      const match = filename.match(/^(.+)_(\d+)\.crdtlog$/);
      if (!match) continue;

      const instanceId = match[1]!;
      const timestamp = parseInt(match[2]!, 10);

      const path = fs.joinPath(logDir, filename);
      let size = 0;
      try {
        const stat = await fs.stat(path);
        size = stat.size;
      } catch {
        // File may have been deleted
        continue;
      }

      logFiles.push({
        filename,
        path,
        instanceId,
        timestamp,
        size,
      });
    }

    // Sort by timestamp ascending
    logFiles.sort((a, b) => a.timestamp - b.timestamp);

    return logFiles;
  }

  /**
   * Read records from a log file as an async generator.
   *
   * @param filePath - Path to the log file
   * @param fs - File system adapter
   * @param startOffset - Optional starting offset (skips header validation if provided)
   * @yields Records with their byte offsets
   */
  static async *readRecords(
    filePath: string,
    fs: FileSystemAdapter,
    startOffset?: number
  ): AsyncGenerator<LogRecordWithOffset> {
    const buffer = await fs.readFile(filePath);

    let offset: number;

    if (startOffset !== undefined) {
      offset = startOffset;
    } else {
      // Validate header
      const header = readLogHeader(buffer);
      if (!header.valid) {
        throw new Error(`Invalid log file: ${header.error}`);
      }
      offset = LOG_HEADER_SIZE;
    }

    // Read records
    while (offset < buffer.length) {
      const recordOffset = offset;
      const record = readLogRecord(buffer, offset);

      if (record.terminated) {
        break;
      }

      yield {
        timestamp: record.timestamp,
        sequence: record.sequence,
        data: record.data,
        offset: recordOffset,
        bytesRead: record.bytesRead,
      };

      offset += record.bytesRead;
    }
  }

  /**
   * Read all records from a log file as an array.
   *
   * @param filePath - Path to the log file
   * @param fs - File system adapter
   * @param startOffset - Optional starting offset
   * @returns Array of records
   */
  static async readAllRecords(
    filePath: string,
    fs: FileSystemAdapter,
    startOffset?: number
  ): Promise<LogRecordWithOffset[]> {
    const records: LogRecordWithOffset[] = [];
    for await (const record of this.readRecords(filePath, fs, startOffset)) {
      records.push(record);
    }
    return records;
  }

  /**
   * Validate a log file's header.
   *
   * @param filePath - Path to the log file
   * @param fs - File system adapter
   * @returns Validation result with version info
   */
  static async validateHeader(
    filePath: string,
    fs: FileSystemAdapter
  ): Promise<{ valid: boolean; version: number; error?: string }> {
    const buffer = await fs.readFile(filePath);
    return readLogHeader(buffer);
  }
}
