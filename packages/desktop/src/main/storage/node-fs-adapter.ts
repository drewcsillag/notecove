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
    return new Uint8Array(buffer);
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

    // Atomic write: write to temp file, then rename
    // Use unique temp file name to avoid race conditions with concurrent writes
    const tempPath = `${path}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 9)}`;
    await fs.writeFile(tempPath, data);
    await fs.rename(tempPath, path);
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
