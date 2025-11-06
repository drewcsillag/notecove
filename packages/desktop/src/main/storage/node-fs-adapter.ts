/**
 * Node.js File System Adapter
 *
 * Implements FileSystemAdapter interface using Node.js fs module
 */

import { promises as fs } from 'fs';
import { join, basename as pathBasename, dirname } from 'path';
import type { FileSystemAdapter, FileStats } from '@notecove/shared';

export class NodeFileSystemAdapter implements FileSystemAdapter {
  async exists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  async mkdir(path: string): Promise<void> {
    await fs.mkdir(path, { recursive: true });
  }

  async readFile(path: string): Promise<Uint8Array> {
    const buffer = await fs.readFile(path);
    const data = new Uint8Array(buffer);

    // Only apply flag byte protocol to .yjson files (CRDT update/snapshot/pack files)
    // This includes .yjson.zst compressed files
    // Other files like activity logs (.log) are plain text
    if (!path.includes('.yjson')) {
      return data;
    }

    // Check for empty file
    if (data.length === 0) {
      throw new Error(`File is empty: ${path}`);
    }

    // Check flag byte (first byte of file)
    const flagByte = data[0];
    if (flagByte === undefined) {
      throw new Error(`File is empty (no flag byte): ${path}`);
    }

    if (flagByte === 0x00) {
      // File is still being written - this indicates a race condition
      // where file sync completed before write finished
      throw new Error(`File is incomplete (still being written): ${path}`);
    }

    if (flagByte !== 0x01) {
      // Invalid flag byte - file may be corrupted or from old version
      throw new Error(`Invalid file format (flag byte: 0x${flagByte.toString(16)}): ${path}`);
    }

    // Return actual data (strip flag byte)
    return data.subarray(1);
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    // Ensure parent directory exists
    // Using recursive:true makes this safe for concurrent calls
    const dir = dirname(path);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Ignore EEXIST errors (directory already exists)
      // This can happen when multiple processes create simultaneously
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }

    // Only apply flag byte protocol to .yjson files (CRDT update/snapshot/pack files)
    // This includes .yjson.zst compressed files
    // Other files like activity logs (.log) are plain text
    if (!path.includes('.yjson')) {
      await fs.writeFile(path, data);
      return;
    }

    // Flag byte approach: prepend 0x00 (not ready), then flip to 0x01 (ready) after write
    // This avoids renames which Google Drive treats as delete+create
    const flaggedData = new Uint8Array(1 + data.length);
    flaggedData[0] = 0x00; // Not ready flag
    flaggedData.set(data, 1); // Copy actual data after flag byte

    // Write all data with "not ready" flag
    const fd = await fs.open(path, 'w');
    try {
      await fd.write(flaggedData, 0, flaggedData.length, 0);
      // Force data to disk before flipping flag
      await fd.sync();

      // Atomically flip flag to "ready"
      const readyFlag = Buffer.from([0x01]);
      await fd.write(readyFlag, 0, 1, 0); // Overwrite byte 0
      // Force flag byte to disk
      await fd.sync();
    } finally {
      await fd.close();
    }
  }

  async deleteFile(path: string): Promise<void> {
    await fs.unlink(path);
  }

  async listFiles(path: string): Promise<string[]> {
    return await fs.readdir(path);
  }

  joinPath(...segments: string[]): string {
    return join(...segments);
  }

  basename(path: string): string {
    return pathBasename(path);
  }

  async stat(path: string): Promise<FileStats> {
    const stats = await fs.stat(path);
    return {
      size: stats.size,
      mtimeMs: stats.mtimeMs,
      ctimeMs: stats.ctimeMs,
    };
  }
}
