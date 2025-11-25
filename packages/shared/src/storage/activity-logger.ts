/**
 * Activity Logger
 *
 * Tracks note editing activity for cross-instance synchronization.
 * Each instance maintains its own log file to avoid multi-writer conflicts.
 */

import type { FileSystemAdapter } from './types';

export class ActivityLogger {
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
   * Always appends a new line for each update to ensure other instances
   * see all intermediate sequence numbers during incremental sync.
   *
   * Format: noteId|instanceId_sequenceNumber
   * This allows other instances to poll for the specific update file.
   *
   * Note: The compact() function prevents unbounded growth by keeping
   * only the last 1000 entries.
   */
  async recordNoteActivity(noteId: string, sequenceNumber: number): Promise<void> {
    const line = `${noteId}|${this.instanceId}_${sequenceNumber}`;

    // Always append - don't use replaceLastLine optimization
    // This ensures other instances see ALL intermediate sequences, which is
    // critical when cloud sync services (iCloud, Dropbox) sync files incrementally
    await this.appendLine(line);
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
