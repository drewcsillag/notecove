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
  reloadNote: (noteId: string, sdId: string) => Promise<void>;

  /**
   * Get list of currently loaded note IDs
   */
  getLoadedNotes: () => string[];
}

export class ActivitySync {
  private lastSeenSequences = new Map<string, number>(); // instanceId -> last sequence number
  private pendingSyncs = new Map<string, Promise<void>>(); // noteId -> pending sync promise

  constructor(
    private fs: FileSystemAdapter,
    private instanceId: string,
    private activityDir: string,
    private sdId: string,
    private callbacks: ActivitySyncCallbacks
  ) {}

  /**
   * Sync from other instances' activity logs
   *
   * Returns a set of note IDs that were affected by the sync.
   * Polls for update files in parallel to avoid head-of-line blocking.
   */
  async syncFromOtherInstances(): Promise<Set<string>> {
    const affectedNotes = new Set<string>();

    try {
      const files = await this.fs.listFiles(this.activityDir);

      for (const file of files) {
        if (!file.endsWith('.log')) continue;

        const otherInstanceId = file.replace('.log', '');
        if (otherInstanceId === this.instanceId) continue; // Skip our own

        const filePath = this.fs.joinPath(this.activityDir, file);

        try {
          const data = await this.fs.readFile(filePath);
          const content = new TextDecoder().decode(data);
          const lines = content.split('\n').filter((l) => l.length > 0);

          if (lines.length === 0) continue;

          const lastSeen = this.lastSeenSequences.get(otherInstanceId) ?? 0;

          // Parse first line to check for sequence gap
          const firstLine = lines[0];
          if (firstLine) {
            const firstParts = firstLine.split('|');
            if (firstParts.length >= 2) {
              const firstInstanceSeq = firstParts[1];
              if (firstInstanceSeq) {
                const firstSeqParts = firstInstanceSeq.split('_');
                const firstSequence = parseInt(firstSeqParts[1] ?? '0');

                // Gap detection: compaction removed entries we haven't seen yet
                if (firstSequence > lastSeen + 1 && lastSeen > 0) {
                  console.warn(
                    `[ActivitySync] Gap detected for ${otherInstanceId} (oldest: ${firstSequence}, last seen: ${lastSeen}), performing full scan`
                  );
                  const reloadedNotes = await this.fullScanAllNotes();
                  for (const noteId of reloadedNotes) {
                    affectedNotes.add(noteId);
                  }
                }
              }
            }
          }

          // Process new entries (those with sequence > lastSeen)
          for (const line of lines) {
            const parts = line.split('|');
            if (parts.length < 2) continue; // Invalid line

            const noteId = parts[0];
            const instanceSeq = parts[1];
            if (!noteId || !instanceSeq) continue;

            const seqParts = instanceSeq.split('_');
            const sequence = parseInt(seqParts[1] ?? '0');

            if (sequence > lastSeen) {
              affectedNotes.add(noteId);

              // Launch parallel poll for this update (fire and forget)
              // Don't await - let all notes poll in parallel
              if (!this.pendingSyncs.has(noteId)) {
                const syncPromise = this.pollAndReload(instanceSeq, noteId);
                this.pendingSyncs.set(noteId, syncPromise);

                // Clean up when done (intentionally fire and forget)
                void syncPromise.finally(() => this.pendingSyncs.delete(noteId));
              }
            }
          }

          this.updateWatermark(otherInstanceId, lines);
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
   * Poll for an update file and reload the note when it appears
   *
   * Uses exponential backoff to avoid hammering the filesystem.
   * Handles both missing files and incomplete files (0x00 flag byte).
   */
  private async pollAndReload(instanceSeq: string, noteId: string): Promise<void> {
    const [instanceId, seqStr] = instanceSeq.split('_');
    const sequenceNum = parseInt(seqStr ?? '0');
    const updateFileName = `${instanceId}_${sequenceNum}.yjson`;

    // Exponential backoff delays (ms)
    const delays = [100, 200, 500, 1000, 2000, 5000, 10000];

    for (const delay of delays) {
      try {
        // Try to reload the note - this will check file existence AND flag byte
        await this.callbacks.reloadNote(noteId, this.sdId);
        return; // Success!
      } catch (error) {
        const errorMessage = (error as Error).message || '';

        // Check if file doesn't exist yet
        if (errorMessage.includes('ENOENT') || errorMessage.includes('does not exist')) {
          // Wait and retry
          await this.sleep(delay);
          continue;
        }

        // Check if file is incomplete (still being written)
        if (errorMessage.includes('incomplete') || errorMessage.includes('still being written')) {
          // Wait and retry - file sync is in progress
          await this.sleep(delay);
          continue;
        }

        // Other error (corrupted file, permissions, etc.) - give up
        console.error(
          `[ActivitySync] Failed to reload ${updateFileName} for note ${noteId}:`,
          error
        );
        return;
      }
    }

    // Timeout - log warning but don't fail
    // File will be retried on next ActivitySync cycle
    console.warn(
      `[ActivitySync] Timeout waiting for ${updateFileName} for note ${noteId}. File may sync later.`
    );
  }

  /**
   * Sleep for a given number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Update our watermark for an instance
   */
  private updateWatermark(instanceId: string, lines: string[]): void {
    if (lines.length > 0) {
      const lastLine = lines[lines.length - 1];
      if (!lastLine) return;

      const parts = lastLine.split('|');
      if (parts.length < 2) return;

      const instanceSeq = parts[1];
      if (!instanceSeq) return;

      const seqParts = instanceSeq.split('_');
      const sequence = parseInt(seqParts[1] ?? '0');

      this.lastSeenSequences.set(instanceId, sequence);
    }
  }

  /**
   * Full scan fallback when gap is detected
   *
   * Reloads all currently loaded notes from disk. This is safe because:
   * 1. Only reloads notes that are already in memory
   * 2. Typically only 1-5 notes are loaded at once
   * 3. CRDT merge is idempotent
   *
   * @returns Set of note IDs that were reloaded
   */
  private async fullScanAllNotes(): Promise<Set<string>> {
    const loadedNotes = this.callbacks.getLoadedNotes();
    const reloadedNotes = new Set<string>();

    for (const noteId of loadedNotes) {
      try {
        await this.callbacks.reloadNote(noteId, this.sdId);
        reloadedNotes.add(noteId);
      } catch (error) {
        console.error(`[ActivitySync] Failed to reload note ${noteId}:`, error);
      }
    }

    return reloadedNotes;
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
    this.lastSeenSequences.clear();
  }

  /**
   * Get current watermarks (useful for debugging)
   */
  getWatermarks(): Map<string, number> {
    return new Map(this.lastSeenSequences);
  }
}
