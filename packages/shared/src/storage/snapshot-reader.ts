/**
 * SnapshotReader - Snapshot file reader
 *
 * Provides static methods for reading and listing .snapshot files.
 * Implements the snapshot selection algorithm (most recent complete snapshot).
 *
 * @see STORAGE-FORMAT-DESIGN.md for specification
 */

/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
// Non-null assertions required for desktop's noUncheckedIndexedAccess

import { parseSnapshotFile, readSnapshotHeader, type VectorClockEntry } from './binary-format';
import type { FileSystemAdapter } from './types';

/** Information about a snapshot file */
export interface SnapshotFileInfo {
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

/** Parsed snapshot content */
export interface SnapshotContent {
  /** Format version */
  version: number;
  /** Whether snapshot write completed successfully */
  complete: boolean;
  /** Vector clock entries */
  vectorClock: VectorClockEntry[];
  /** Yjs document state */
  documentState: Uint8Array;
}

export class SnapshotReader {
  /**
   * List all .snapshot files in a directory, sorted by timestamp descending (newest first).
   *
   * @param snapshotDir - Directory to scan
   * @param fs - File system adapter
   * @returns Array of snapshot file info, sorted by timestamp descending
   */
  static async listSnapshotFiles(
    snapshotDir: string,
    fs: FileSystemAdapter
  ): Promise<SnapshotFileInfo[]> {
    let files: string[];
    try {
      files = await fs.listFiles(snapshotDir);
    } catch {
      return [];
    }

    const snapshotFiles: SnapshotFileInfo[] = [];

    for (const filename of files) {
      if (!filename.endsWith('.snapshot')) continue;

      // Parse filename: {instanceId}_{timestamp}.snapshot
      const match = filename.match(/^(.+)_(\d+)\.snapshot$/);
      if (!match) continue;

      const instanceId = match[1]!;
      const timestamp = parseInt(match[2]!, 10);

      const path = fs.joinPath(snapshotDir, filename);
      let size = 0;
      try {
        const stat = await fs.stat(path);
        size = stat.size;
      } catch {
        // File may have been deleted
        continue;
      }

      snapshotFiles.push({
        filename,
        path,
        instanceId,
        timestamp,
        size,
      });
    }

    // Sort by timestamp descending (newest first)
    snapshotFiles.sort((a, b) => b.timestamp - a.timestamp);

    return snapshotFiles;
  }

  /**
   * Find the best snapshot to use (most recent complete snapshot).
   *
   * Algorithm:
   * 1. List all snapshot files, sorted by timestamp descending
   * 2. For each snapshot (newest first):
   *    - Check if complete (status = 0x01)
   *    - If complete, return it
   *    - If incomplete, skip to next
   * 3. Return null if no complete snapshots found
   *
   * @param snapshotDir - Directory to scan
   * @param fs - File system adapter
   * @returns Best snapshot info or null if none available
   */
  static async findBestSnapshot(
    snapshotDir: string,
    fs: FileSystemAdapter
  ): Promise<SnapshotFileInfo | null> {
    const files = await this.listSnapshotFiles(snapshotDir, fs);

    for (const file of files) {
      const isComplete = await this.isComplete(file.path, fs);
      if (isComplete) {
        return file;
      }
    }

    return null;
  }

  /**
   * Read and parse a snapshot file.
   *
   * @param filePath - Path to the snapshot file
   * @param fs - File system adapter
   * @returns Parsed snapshot content
   */
  static async readSnapshot(filePath: string, fs: FileSystemAdapter): Promise<SnapshotContent> {
    const buffer = await fs.readFile(filePath);
    return parseSnapshotFile(buffer);
  }

  /**
   * Check if a snapshot file is complete (status = 0x01).
   *
   * @param filePath - Path to the snapshot file
   * @param fs - File system adapter
   * @returns True if snapshot is complete
   */
  static async isComplete(filePath: string, fs: FileSystemAdapter): Promise<boolean> {
    const buffer = await fs.readFile(filePath);
    const header = readSnapshotHeader(buffer);
    return header.valid && header.complete;
  }
}
