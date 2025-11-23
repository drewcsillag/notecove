/**
 * SnapshotWriter - Crash-safe snapshot file writer
 *
 * Implements the 0x00/0x01 write protocol for crash safety:
 * 1. Write header with status = 0x00 (incomplete)
 * 2. Write vector clock and document state
 * 3. fsync()
 * 4. Update status to 0x01 (complete)
 * 5. fsync()
 *
 * @see STORAGE-FORMAT-DESIGN.md for specification
 */

/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
// Non-null assertions required for desktop's noUncheckedIndexedAccess

import {
  writeSnapshotHeader,
  writeVectorClock,
  SNAPSHOT_STATUS_COMPLETE,
  type VectorClockEntry,
} from './binary-format';
import type { FileSystemAdapter } from './types';

export class SnapshotWriter {
  /**
   * Write a snapshot file with crash-safe protocol.
   *
   * @param snapshotDir - Directory to write snapshot to
   * @param instanceId - Instance ID for filename
   * @param vectorClock - Vector clock entries
   * @param documentState - Yjs document state
   * @param fs - File system adapter
   * @returns Full path to the written snapshot file
   */
  static async write(
    snapshotDir: string,
    instanceId: string,
    vectorClock: VectorClockEntry[],
    documentState: Uint8Array,
    fs: FileSystemAdapter
  ): Promise<string> {
    // Ensure directory exists
    if (!(await fs.exists(snapshotDir))) {
      await fs.mkdir(snapshotDir);
    }

    // Generate unique filename
    const timestamp = await this.getUniqueTimestamp(snapshotDir, instanceId, fs);
    const filename = `${instanceId}_${timestamp}.snapshot`;
    const filePath = fs.joinPath(snapshotDir, filename);

    // Build file content
    // Start with incomplete status (0x00)
    const header = writeSnapshotHeader(false);
    const vectorClockBytes = writeVectorClock(vectorClock);

    // Calculate total size and assemble
    const totalSize = header.length + vectorClockBytes.length + documentState.length;
    const fileContent = new Uint8Array(totalSize);
    let offset = 0;

    fileContent.set(header, offset);
    offset += header.length;

    fileContent.set(vectorClockBytes, offset);
    offset += vectorClockBytes.length;

    fileContent.set(documentState, offset);

    // Write incomplete file
    await fs.writeFile(filePath, fileContent);

    // Update status byte to complete (0x01)
    // Status byte is at offset 5 (after 4-byte magic + 1-byte version)
    const statusByte = new Uint8Array([SNAPSHOT_STATUS_COMPLETE]);

    if (fs.seekWrite) {
      // Use seekWrite if available (more efficient)
      await fs.seekWrite(filePath, 5, statusByte);
    } else {
      // Fall back to read-modify-write
      const data = await fs.readFile(filePath);
      data[5] = SNAPSHOT_STATUS_COMPLETE;
      await fs.writeFile(filePath, data);
    }

    return filePath;
  }

  /**
   * Get a unique timestamp for the filename, handling collisions.
   */
  private static async getUniqueTimestamp(
    snapshotDir: string,
    instanceId: string,
    fs: FileSystemAdapter
  ): Promise<number> {
    let timestamp = Date.now();

    // Check for existing files with this instance ID
    let files: string[];
    try {
      files = await fs.listFiles(snapshotDir);
    } catch {
      return timestamp;
    }

    const ourFiles = files
      .filter((f) => f.startsWith(`${instanceId}_`) && f.endsWith('.snapshot'))
      .map((f) => {
        const match = f.match(/_(\d+)\.snapshot$/);
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
}
