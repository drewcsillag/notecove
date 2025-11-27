/**
 * Activity Sync
 *
 * Synchronizes note activity across multiple instances by reading other
 * instances' activity logs and triggering note reloads.
 */

import type { FileSystemAdapter } from './types';

/**
 * Metrics callback interface for sync telemetry
 */
export interface SyncMetricsCallbacks {
  /**
   * Record a successful sync operation
   */
  recordSyncSuccess?: (latencyMs: number, attempts: number, noteId: string, sdId: string) => void;

  /**
   * Record a failed sync operation (non-timeout error)
   */
  recordSyncFailure?: (noteId: string, sdId: string) => void;

  /**
   * Record a sync timeout
   */
  recordSyncTimeout?: (attempts: number, noteId: string, sdId: string) => void;

  /**
   * Record a full scan fallback
   */
  recordFullScan?: (notesReloaded: number, sdId: string) => void;

  /**
   * Record activity log processing
   */
  recordActivityLogProcessed?: (instanceId: string, sdId: string) => void;
}

export interface ActivitySyncCallbacks {
  /**
   * Reload a note from disk if it's currently loaded
   */
  reloadNote: (noteId: string, sdId: string) => Promise<void>;

  /**
   * Get list of currently loaded note IDs
   */
  getLoadedNotes: () => string[];

  /**
   * Check if a CRDT log file exists for a given note and instance with expected sequence.
   * Used to verify the CRDT log has synced before triggering reload.
   * Returns true if a .crdtlog file exists with at least the expected sequence number.
   *
   * @param noteId - The note ID
   * @param instanceId - The instance ID to check
   * @param expectedSequence - The sequence number we're syncing to (from activity log)
   */
  checkCRDTLogExists?: (
    noteId: string,
    instanceId: string,
    expectedSequence: number
  ) => Promise<boolean>;

  /**
   * Check if a note exists (was not permanently deleted).
   * Used to skip syncing for notes that have been permanently deleted.
   * Returns true if the note directory exists on disk.
   *
   * @param noteId - The note ID to check
   */
  checkNoteExists?: (noteId: string) => Promise<boolean>;

  /**
   * Optional metrics callbacks for telemetry
   */
  metrics?: SyncMetricsCallbacks;
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

        // Record activity log processed metric
        this.callbacks.metrics?.recordActivityLogProcessed?.(otherInstanceId, this.sdId);

        const filePath = this.fs.joinPath(this.activityDir, file);

        try {
          const data = await this.fs.readFile(filePath);
          const content = new TextDecoder().decode(data);
          // Split by newlines and filter empty lines
          // IMPORTANT: If the content doesn't end with \n, the last "line" is incomplete
          // (partial sync - file still being written by cloud storage). Exclude it.
          const allLines = content.split('\n');
          const hasTrailingNewline = content.endsWith('\n');
          const lines = hasTrailingNewline
            ? allLines.filter((l) => l.length > 0)
            : allLines.slice(0, -1).filter((l) => l.length > 0);

          if (lines.length === 0) continue;

          const lastSeen = this.lastSeenSequences.get(otherInstanceId) ?? -1;

          console.log(
            `[ActivitySync] Reading ${file}: ${lines.length} lines, lastSeen=${lastSeen}, firstSeq=${lines[0]?.split('|')[1]}, lastSeq=${lines[lines.length - 1]?.split('|')[1]}`
          );

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
          // DON'T update watermark here - it will be updated after successful sync
          // This prevents race conditions where watermark updates before content syncs
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
                this.startSyncChain(noteId, otherInstanceId);
              }
            }
          }
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
   *
   * @param noteId The note to sync
   * @param otherInstanceId The instance ID whose activity we're syncing from
   */
  private startSyncChain(noteId: string, otherInstanceId: string): void {
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
      const success = await this.pollAndReload(target.instanceSeq, noteId);

      // Update watermark ONLY after successful sync
      // This prevents the race condition where we mark sequences as "seen" before their content syncs
      if (success) {
        this.lastSeenSequences.set(otherInstanceId, target.sequence);
        console.log(
          `[ActivitySync] Watermark updated for ${otherInstanceId} to ${target.sequence}`
        );
      }

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
   *
   * IMPORTANT: Before calling reloadNote, we verify the CRDT log file from
   * the source instance actually exists. This prevents a race condition where
   * the activity log syncs before the CRDT log, causing reloadNote to succeed
   * but not find any new content (since the CRDT log isn't there yet).
   *
   * @returns true if sync succeeded, false if it failed/timed out
   */
  private async pollAndReload(instanceSeq: string, noteId: string): Promise<boolean> {
    // Exponential backoff delays (ms)
    // Extended delays to handle slow cloud sync (e.g., iCloud, Dropbox, Google Drive, OneDrive)
    const delays = [100, 200, 500, 1000, 2000, 3000, 5000, 7000, 10000, 15000];

    // Parse instance ID and sequence from instanceSeq (format: "{instanceId}_{sequence}")
    const seqParts = instanceSeq.split('_');
    const expectedSequence = parseInt(seqParts[seqParts.length - 1] ?? '0');
    const sourceInstanceId = seqParts.length > 1 ? seqParts.slice(0, -1).join('_') : instanceSeq;

    console.log(
      `[ActivitySync] Starting pollAndReload for note ${noteId}, sequence ${instanceSeq}, sourceInstance: ${sourceInstanceId}, expectedSeq: ${expectedSequence}`
    );

    // Check if note was permanently deleted before starting retry loop
    // This prevents blocking app startup when activity log has orphaned entries
    if (this.callbacks.checkNoteExists) {
      const exists = await this.callbacks.checkNoteExists(noteId);
      if (!exists) {
        console.log(`[ActivitySync] Note ${noteId} was permanently deleted, skipping sync`);
        // Return true to update watermark and skip this entry
        return true;
      }
    }

    const startTime = Date.now();

    for (let attempt = 0; attempt < delays.length; attempt++) {
      const delay = delays[attempt] ?? 0;
      console.log(
        `[ActivitySync] Attempt ${attempt + 1}/${delays.length} for note ${noteId}, sequence ${instanceSeq}`
      );

      try {
        // CRITICAL: Check if the CRDT log file from the source instance has the expected
        // sequence. This prevents the race condition where activity log syncs before CRDT
        // log, causing reloadNote to read stale content.
        if (this.callbacks.checkCRDTLogExists) {
          const hasExpectedSeq = await this.callbacks.checkCRDTLogExists(
            noteId,
            sourceInstanceId,
            expectedSequence
          );
          if (!hasExpectedSeq) {
            console.log(
              `[ActivitySync] CRDT log for instance ${sourceInstanceId} not ready (expected seq ${expectedSequence}), attempt ${attempt + 1}, will retry after ${delay}ms`
            );
            await this.sleep(delay);
            continue;
          }
          console.log(
            `[ActivitySync] CRDT log for instance ${sourceInstanceId} has expected seq ${expectedSequence}, proceeding with reload`
          );
        }

        // Try to reload the note - this will read all .crdtlog files
        await this.callbacks.reloadNote(noteId, this.sdId);
        console.log(
          `[ActivitySync] SUCCESS on attempt ${attempt + 1} for note ${noteId}, sequence ${instanceSeq}`
        );

        // Record success metrics
        const latencyMs = Date.now() - startTime;
        this.callbacks.metrics?.recordSyncSuccess?.(latencyMs, attempt + 1, noteId, this.sdId);

        return true; // Success!
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

        // Record failure metrics
        this.callbacks.metrics?.recordSyncFailure?.(noteId, this.sdId);

        return false;
      }
    }

    // Timeout - log warning but don't fail
    // File will be retried on next ActivitySync cycle
    console.warn(
      `[ActivitySync] Timeout after ${delays.length} attempts waiting for note ${noteId} sequence ${instanceSeq}. File may sync later.`
    );

    // Record timeout metrics
    this.callbacks.metrics?.recordSyncTimeout?.(delays.length, noteId, this.sdId);

    return false;
  }

  /**
   * Sleep for a given number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

    // Record full scan metrics
    this.callbacks.metrics?.recordFullScan?.(reloadedNotes.size, this.sdId);

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
