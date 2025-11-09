/**
 * Activity Logger
 *
 * Tracks note editing activity for cross-instance synchronization.
 * Each instance maintains its own log file to avoid multi-writer conflicts.
 */

import type { FileSystemAdapter } from './types';

export class ActivityLogger {
  private lastNoteWritten: string | null = null;
  private activityLogPath: string;
  private instanceId = '';

  constructor(
    private fs: FileSystemAdapter,
    private activityDir: string
  ) {
    // Instance ID will be passed via setInstanceId() after construction
    this.activityLogPath = '';
  }

  /**
   * Set instance ID and initialize log path
   */
  setInstanceId(instanceId: string): void {
    this.instanceId = instanceId;
    this.activityLogPath = this.fs.joinPath(this.activityDir, `${instanceId}.log`);
  }

  /**
   * Initialize activity logger (ensure directory exists)
   */
  async initialize(): Promise<void> {
    await this.fs.mkdir(this.activityDir);
  }

  /**
   * Record note activity
   *
   * If the same note is edited consecutively, replaces the last line.
   * Otherwise, appends a new line.
   *
   * Format: noteId|instanceId_sequenceNumber
   * This allows other instances to poll for the specific update file.
   */
  async recordNoteActivity(noteId: string, sequenceNumber: number): Promise<void> {
    const line = `${noteId}|${this.instanceId}_${sequenceNumber}`;

    if (this.lastNoteWritten === noteId) {
      // Same note edited consecutively - replace last line
      await this.replaceLastLine(line);
    } else {
      // Different note - append new line
      await this.appendLine(line);
      this.lastNoteWritten = noteId;
    }
  }

  /**
   * Append a line to the activity log
   */
  private async appendLine(line: string): Promise<void> {
    try {
      // Read existing content
      const existingData = await this.fs.readFile(this.activityLogPath);
      const existingText = new TextDecoder().decode(existingData);
      const newText = existingText + line + '\n';
      const newData = new TextEncoder().encode(newText);
      await this.fs.writeFile(this.activityLogPath, newData);
    } catch {
      // File doesn't exist, create it
      const newData = new TextEncoder().encode(line + '\n');
      await this.fs.writeFile(this.activityLogPath, newData);
    }
  }

  /**
   * Replace the last line in the activity log
   *
   * This is used when the same note is edited consecutively to avoid
   * creating thousands of entries during continuous typing.
   */
  private async replaceLastLine(newLine: string): Promise<void> {
    try {
      const data = await this.fs.readFile(this.activityLogPath);
      const content = new TextDecoder().decode(data);
      const lines = content.split('\n').filter((l) => l.length > 0);

      if (lines.length === 0) {
        // File is empty, just append
        await this.appendLine(newLine);
        return;
      }

      // Replace last line
      lines[lines.length - 1] = newLine;
      const newContent = lines.join('\n') + '\n';
      const newData = new TextEncoder().encode(newContent);
      await this.fs.writeFile(this.activityLogPath, newData);
    } catch {
      // File might not exist yet, create it
      await this.appendLine(newLine);
    }
  }

  /**
   * Compact activity log to keep only the last N entries
   *
   * This prevents unbounded file growth. Safe to call from any instance
   * because each instance only modifies its own log file.
   */
  async compact(maxEntries = 1000): Promise<void> {
    try {
      const data = await this.fs.readFile(this.activityLogPath);
      const content = new TextDecoder().decode(data);
      const lines = content.split('\n').filter((l) => l.length > 0);

      if (lines.length > maxEntries) {
        const kept = lines.slice(-maxEntries);
        const newContent = kept.join('\n') + '\n';
        const newData = new TextEncoder().encode(newContent);
        await this.fs.writeFile(this.activityLogPath, newData);
      }
    } catch (error) {
      // File might not exist yet, that's fine
      console.error('[ActivityLogger] Failed to compact:', error);
    }
  }

  /**
   * Get the path to this instance's activity log
   */
  getLogPath(): string {
    return this.activityLogPath;
  }
}
