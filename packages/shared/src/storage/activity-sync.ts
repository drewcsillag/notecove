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
  private highestPendingSequence = new Map<string, { instanceSeq: string; sequence: number }>(); // noteId -> highest sequence

  constructor(
    private fs: FileSystemAdapter,
    private instanceId: string,
    private activityDir: string,
    private sdId: string,
    private callbacks: ActivitySyncCallbacks
  ) {}

  /**
   * Wait for all pending syncs to complete
   *
   * This ensures that all poll-and-reload operations have finished before
   * broadcasting update events to renderer processes.
   */
  async waitForPendingSyncs(): Promise<void> {
    if (this.pendingSyncs.size === 0) {
      return;
    }

    await Promise.all(Array.from(this.pendingSyncs.values()));
  }

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

          const lastSeen = this.lastSeenSequences.get(otherInstanceId) ?? -1;

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

              // Track the highest sequence we need to sync to
              const existing = this.highestPendingSequence.get(noteId);
              if (!existing || sequence > existing.sequence) {
                this.highestPendingSequence.set(noteId, { instanceSeq, sequence });
              }

              // If there's no pending sync, start one
              // Otherwise, the pending sync will be followed by another sync for the highest sequence
              if (!this.pendingSyncs.has(noteId)) {
                this.startSyncChain(noteId);
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
   * Start a sync chain for a note
   *
   * The chain works as follows:
   * 1. Poll and reload for the current highest sequence
   * 2. When done, check if there's a new highest sequence
   * 3. If yes, sync again for the new highest sequence
   * 4. Repeat until no new sequences appear
   *
   * This ensures we always sync to the latest available sequence, even if
   * new sequences arrive while we're still polling for earlier ones.
   */
  private startSyncChain(noteId: string): void {
    const syncOneAndContinue = async (): Promise<void> => {
      // Get the current highest sequence we need to sync to
      const target = this.highestPendingSequence.get(noteId);
      if (!target) {
        // No pending sequence, we're done
        return;
      }

      // Clear the pending marker before syncing
      // This allows new sequences to be recorded while we're syncing
      this.highestPendingSequence.delete(noteId);

      console.log(
        `[ActivitySync] Syncing note ${noteId} to sequence ${target.sequence} (${target.instanceSeq})`
      );

      // Sync to this sequence
      await this.pollAndReload(target.instanceSeq, noteId);

      // Check if a new higher sequence arrived while we were syncing
      const newTarget = this.highestPendingSequence.get(noteId);
      if (newTarget && newTarget.sequence > target.sequence) {
        console.log(
          `[ActivitySync] New sequences arrived for note ${noteId}, continuing sync chain to sequence ${newTarget.sequence}`
        );
        // Recursively continue the chain
        await syncOneAndContinue();
      }
    };

    // Start the chain and track it
    const chainPromise = syncOneAndContinue();
    this.pendingSyncs.set(noteId, chainPromise);

    // Clean up when done
    void chainPromise.finally(() => {
      if (this.pendingSyncs.get(noteId) === chainPromise) {
        this.pendingSyncs.delete(noteId);
      }
    });
  }

  /**
   * Poll for an update file and reload the note when it appears
   *
   * Uses exponential backoff to avoid hammering the filesystem.
   * Handles both missing files and incomplete files (0x00 flag byte).
   */
  private async pollAndReload(instanceSeq: string, noteId: string): Promise<void> {
    // Exponential backoff delays (ms)
    // Extended delays to handle slow cloud sync (e.g., iCloud incremental sync)
    const delays = [100, 200, 500, 1000, 2000, 3000, 5000, 7000, 10000, 15000];

    console.log(
      `[ActivitySync] Starting pollAndReload for note ${noteId}, sequence ${instanceSeq}`
    );

    for (let attempt = 0; attempt < delays.length; attempt++) {
      const delay = delays[attempt] ?? 0;
      console.log(
        `[ActivitySync] Attempt ${attempt + 1}/${delays.length} for note ${noteId}, sequence ${instanceSeq}`
      );

      try {
        // Try to reload the note - this will read all .crdtlog files
        await this.callbacks.reloadNote(noteId, this.sdId);
        console.log(
          `[ActivitySync] SUCCESS on attempt ${attempt + 1} for note ${noteId}, sequence ${instanceSeq}`
        );
        return; // Success!
      } catch (error) {
        const errorMessage = (error as Error).message || '';

        // Check if file doesn't exist yet
        if (errorMessage.includes('ENOENT') || errorMessage.includes('does not exist')) {
          console.log(
            `[ActivitySync] File not found (attempt ${attempt + 1}), will retry after ${delay}ms: ${errorMessage}`
          );
          await this.sleep(delay);
          continue;
        }

        // Check if file is incomplete (still being written) or has truncation errors
        // Truncation errors occur when iCloud/cloud storage syncs files incrementally
        if (
          errorMessage.includes('incomplete') ||
          errorMessage.includes('still being written') ||
          errorMessage.includes('Truncated record') ||
          errorMessage.includes('Truncated header')
        ) {
          console.log(
            `[ActivitySync] File incomplete/truncated (attempt ${attempt + 1}), will retry after ${delay}ms: ${errorMessage}`
          );
          await this.sleep(delay);
          continue;
        }

        // Other error (corrupted file, permissions, etc.) - give up
        console.error(
          `[ActivitySync] Failed to reload note ${noteId} for sequence ${instanceSeq} (attempt ${attempt + 1}):`,
          error
        );
        return;
      }
    }

    // Timeout - log warning but don't fail
    // File will be retried on next ActivitySync cycle
    console.warn(
      `[ActivitySync] Timeout after ${delays.length} attempts waiting for note ${noteId} sequence ${instanceSeq}. File may sync later.`
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
