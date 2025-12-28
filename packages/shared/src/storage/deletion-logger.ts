/**
 * Deletion Logger
 *
 * Tracks permanent note deletions for cross-instance synchronization.
 * Each instance maintains its own log file to avoid multi-writer conflicts.
 *
 * Log format: {noteId}|{timestamp}\n
 * - noteId: The UUID of the deleted note
 * - timestamp: Unix timestamp (ms) when the deletion occurred
 */

import type { FileSystemAdapter } from './types';

export class DeletionLogger {
  private deletionLogPath: string;

  constructor(
    private fs: FileSystemAdapter,
    private deletionDir: string
  ) {
    // IDs will be passed via setIds() after construction
    this.deletionLogPath = '';
  }

  /**
   * Set profile and instance IDs and initialize log path
   *
   * New filename format: {profileId}_{instanceId}.log
   * Old format ({instanceId}.log) is still readable for backward compatibility.
   */
  setIds(profileId: string, instanceId: string): void {
    this.deletionLogPath = this.fs.joinPath(this.deletionDir, `${profileId}_${instanceId}.log`);
  }

  /**
   * @deprecated Use setIds() instead
   */
  setInstanceId(instanceId: string): void {
    // Legacy support - uses instanceId as both profile and instance
    this.setIds(instanceId, instanceId);
  }

  /**
   * Initialize deletion logger (ensure directory exists)
   */
  async initialize(): Promise<void> {
    await this.fs.mkdir(this.deletionDir);
  }

  /**
   * Record a permanent deletion
   *
   * IMPORTANT: This must be called BEFORE deleting the note files from disk.
   * The deletion entry ensures other instances can discover and replicate
   * the deletion even if cloud sync delivers files out of order.
   *
   * Format: noteId|timestamp
   */
  async recordDeletion(noteId: string): Promise<void> {
    const timestamp = Date.now();
    const line = `${noteId}|${timestamp}`;
    await this.appendLine(line);
  }

  /**
   * Append a line to the deletion log
   */
  private async appendLine(line: string): Promise<void> {
    try {
      // Read existing content
      const existingData = await this.fs.readFile(this.deletionLogPath);
      const existingText = new TextDecoder().decode(existingData);
      const newText = existingText + line + '\n';
      const newData = new TextEncoder().encode(newText);
      await this.fs.writeFile(this.deletionLogPath, newData);
    } catch {
      // File doesn't exist, create it
      const newData = new TextEncoder().encode(line + '\n');
      await this.fs.writeFile(this.deletionLogPath, newData);
    }
  }

  /**
   * Get the path to this instance's deletion log
   */
  getLogPath(): string {
    return this.deletionLogPath;
  }

  /**
   * Get the deletion directory path
   */
  getDeletionDir(): string {
    return this.deletionDir;
  }
}
