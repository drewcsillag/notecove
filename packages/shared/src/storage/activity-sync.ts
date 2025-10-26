/**
 * Activity Sync
 *
 * Synchronizes note activity across multiple instances by reading other
 * instances' activity logs and triggering note reloads.
 */

import type { FileSystemAdapter } from './types';

export interface ActivitySyncCallbacks {
  /**
   * Reload a note from disk if it's currently loaded
   */
  reloadNote: (noteId: string) => Promise<void>;

  /**
   * Get list of currently loaded note IDs
   */
  getLoadedNotes: () => string[];
}

export class ActivitySync {
  private lastSeenTimestamps = new Map<string, number>();

  constructor(
    private fs: FileSystemAdapter,
    private instanceId: string,
    private activityDir: string,
    private callbacks: ActivitySyncCallbacks
  ) {}

  /**
   * Sync from other instances' activity logs
   *
   * Returns a set of note IDs that were affected by the sync.
   */
  async syncFromOtherInstances(): Promise<Set<string>> {
    const affectedNotes = new Set<string>();

    try {
      const files = await this.fs.listFiles(this.activityDir);

      for (const file of files) {
        if (!file.endsWith('.log')) continue;

        const instanceId = file.replace('.log', '');
        if (instanceId === this.instanceId) continue; // Skip our own

        const filePath = this.fs.joinPath(this.activityDir, file);

        try {
          const data = await this.fs.readFile(filePath);
          const content = new TextDecoder().decode(data);
          const lines = content.split('\n').filter((l) => l.length > 0);

          if (lines.length === 0) continue;

          const lastSeen = this.lastSeenTimestamps.get(instanceId) ?? 0;
          const oldestLine = lines[0];
          if (!oldestLine) continue;
          const oldestPart = oldestLine.split('|')[0];
          if (!oldestPart) continue;
          const oldestTimestamp = parseInt(oldestPart);

          // Gap detection: compaction removed entries we haven't seen yet
          if (oldestTimestamp > lastSeen && lastSeen > 0) {
            console.warn(
              `[ActivitySync] Gap detected for ${instanceId} (oldest: ${oldestTimestamp}, last seen: ${lastSeen}), performing full scan`
            );
            await this.fullScanAllNotes();
            this.updateWatermark(instanceId, lines);
            continue;
          }

          // Process new entries (those with timestamp > lastSeen)
          for (const line of lines) {
            const parts = line.split('|');
            if (parts.length < 2) continue; // Invalid line

            const timestamp = parts[0];
            const noteId = parts[1];
            if (!timestamp || !noteId) continue;

            const ts = parseInt(timestamp);

            if (ts > lastSeen) {
              await this.callbacks.reloadNote(noteId);
              affectedNotes.add(noteId);
            }
          }

          this.updateWatermark(instanceId, lines);
        } catch (error) {
          // File might have been deleted or is corrupted
          console.error(`[ActivitySync] Failed to read ${file}:`, error);
        }
      }
    } catch (error) {
      console.error('[ActivitySync] Failed to sync from other instances:', error);
    }

    return affectedNotes;
  }

  /**
   * Update our watermark for an instance
   */
  private updateWatermark(instanceId: string, lines: string[]): void {
    if (lines.length > 0) {
      const lastLine = lines[lines.length - 1];
      if (!lastLine) return;
      const latestPart = lastLine.split('|')[0];
      if (!latestPart) return;
      const latestTimestamp = parseInt(latestPart);
      this.lastSeenTimestamps.set(instanceId, latestTimestamp);
    }
  }

  /**
   * Full scan fallback when gap is detected
   *
   * Reloads all currently loaded notes from disk. This is safe because:
   * 1. Only reloads notes that are already in memory
   * 2. Typically only 1-5 notes are loaded at once
   * 3. CRDT merge is idempotent
   */
  private async fullScanAllNotes(): Promise<void> {
    const loadedNotes = this.callbacks.getLoadedNotes();

    for (const noteId of loadedNotes) {
      try {
        await this.callbacks.reloadNote(noteId);
      } catch (error) {
        console.error(`[ActivitySync] Failed to reload note ${noteId}:`, error);
      }
    }
  }

  /**
   * Clean up orphaned activity logs
   *
   * Note: This is a no-op in the current implementation because
   * FileSystemAdapter doesn't provide stat() or unlink() methods.
   * Orphaned logs are harmless and will be small (~60KB max after compaction).
   *
   * TODO: Add cleanup when FileSystemAdapter gains stat/unlink support.
   */
  async cleanupOrphanedLogs(): Promise<void> {
    // No-op for now - FileSystemAdapter doesn't have stat() or deleteFile()
    // methods for listing file metadata or selective deletion.
    // This is not critical as orphaned logs are small and harmless.
  }

  /**
   * Reset watermark tracking (useful for testing)
   */
  resetWatermarks(): void {
    this.lastSeenTimestamps.clear();
  }

  /**
   * Get current watermarks (useful for debugging)
   */
  getWatermarks(): Map<string, number> {
    return new Map(this.lastSeenTimestamps);
  }
}
