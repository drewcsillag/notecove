/**
 * Activity Sync
 *
 * Synchronizes note activity across multiple instances by reading other
 * instances' activity logs and triggering note reloads.
 */

import type { FileSystemAdapter } from './types';

/**
 * Default threshold for detecting stale entries.
 * If the gap between an entry's sequence and the highest sequence from that instance
 * exceeds this threshold, the entry is considered stale.
 */
export const STALE_SEQUENCE_GAP_THRESHOLD = 50;

/**
 * Information about a stale sync entry
 */
export interface StaleEntry {
  noteId: string;
  sourceInstanceId: string;
  expectedSequence: number;
  highestSequenceFromInstance: number;
  gap: number;
  detectedAt: number;
}

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

  /**
   * Get list of previously skipped stale entries (loaded from persistence)
   * Returns array of "noteId:sourceInstanceId" strings
   */
  getSkippedStaleEntries?: () => Promise<string[]>;

  /**
   * Persist a skipped stale entry
   * Called when user clicks "Skip" on a stale entry
   */
  onSkipStaleEntry?: (noteId: string, sourceInstanceId: string) => Promise<void>;
}

export class ActivitySync {
  // Track line count per instance's activity log file
  // This is more robust than tracking sequence numbers because:
  // 1. Sequence numbers are per-note, not per-instance
  // 2. A single activity log file contains entries for multiple notes with independent sequences
  // 3. Using line count ensures we process ALL new entries regardless of their sequence numbers
  private lastSeenLineCount = new Map<string, number>(); // instanceId -> line count processed
  private pendingSyncs = new Map<string, Promise<void>>(); // noteId -> pending sync promise
  private highestPendingSequence = new Map<string, { instanceSeq: string; sequence: number }>(); // noteId -> highest sequence

  // Stale entries tracking for UI display
  private staleEntries: StaleEntry[] = [];

  // Skipped stale entries (persisted) - "noteId:sourceInstanceId" format
  private skippedEntries = new Set<string>();
  private skippedEntriesLoaded = false;

  constructor(
    private fs: FileSystemAdapter,
    private instanceId: string,
    private activityDir: string,
    private sdId: string,
    private callbacks: ActivitySyncCallbacks
  ) {}

  /**
   * Load previously skipped entries from persistence
   * Should be called once during initialization
   */
  async loadSkippedEntries(): Promise<void> {
    if (this.skippedEntriesLoaded) return;

    if (this.callbacks.getSkippedStaleEntries) {
      try {
        const entries = await this.callbacks.getSkippedStaleEntries();
        for (const entry of entries) {
          this.skippedEntries.add(entry);
        }
        console.log(`[ActivitySync] Loaded ${entries.length} skipped stale entries`);
      } catch (error) {
        console.error('[ActivitySync] Failed to load skipped entries:', error);
      }
    }
    this.skippedEntriesLoaded = true;
  }

  /**
   * Check if a stale entry has been skipped
   */
  private isSkipped(noteId: string, sourceInstanceId: string): boolean {
    return this.skippedEntries.has(`${noteId}:${sourceInstanceId}`);
  }

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
   * Get the number of pending syncs
   * Used by the UI to show sync status indicator
   */
  getPendingSyncCount(): number {
    return this.pendingSyncs.size;
  }

  /**
   * Get the IDs of notes with pending syncs
   * Used by the UI to show which notes are syncing
   */
  getPendingNoteIds(): string[] {
    return Array.from(this.pendingSyncs.keys());
  }

  /**
   * Get list of stale entries detected during sync
   * Used by the UI to show which entries are stuck
   */
  getStaleEntries(): StaleEntry[] {
    return [...this.staleEntries];
  }

  /**
   * Clear stale entries (e.g., after user acknowledges them)
   */
  clearStaleEntries(): void {
    this.staleEntries = [];
  }

  /**
   * Remove a specific stale entry (e.g., after user skips it)
   */
  async removeStaleEntry(noteId: string, sourceInstanceId: string): Promise<void> {
    // Remove from in-memory list
    this.staleEntries = this.staleEntries.filter(
      (e) => !(e.noteId === noteId && e.sourceInstanceId === sourceInstanceId)
    );

    // Add to skipped set (prevents re-detection)
    const key = `${noteId}:${sourceInstanceId}`;
    this.skippedEntries.add(key);

    // Persist the skip
    if (this.callbacks.onSkipStaleEntry) {
      await this.callbacks.onSkipStaleEntry(noteId, sourceInstanceId);
    }
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

          const lastSeenCount = this.lastSeenLineCount.get(otherInstanceId) ?? 0;

          console.log(
            `[ActivitySync] Reading ${file}: ${lines.length} lines, lastSeenCount=${lastSeenCount}, newLines=${lines.length - lastSeenCount}`
          );

          // Gap detection: if file has fewer lines than we've seen, it was compacted/truncated
          // This means we may have missed entries, so do a full scan
          if (lines.length < lastSeenCount && lastSeenCount > 0) {
            console.warn(
              `[ActivitySync] File compaction detected for ${otherInstanceId} (current: ${lines.length} lines, last seen: ${lastSeenCount}), performing full scan`
            );
            const reloadedNotes = await this.fullScanAllNotes();
            for (const noteId of reloadedNotes) {
              affectedNotes.add(noteId);
            }
            // Reset line count to current file size
            this.lastSeenLineCount.set(otherInstanceId, lines.length);
            continue;
          }

          // FIRST PASS: Find the highest sequence from this instance across ALL lines
          // This is needed to detect stale entries (entries with sequence far behind the highest)
          let highestSeqFromInstance = 0;
          for (const line of lines) {
            const parts = line.split('|');
            if (parts.length < 2) continue;
            const instanceSeq = parts[1];
            if (!instanceSeq) continue;
            const seqParts = instanceSeq.split('_');
            const seq = parseInt(seqParts[1] ?? '0');
            if (seq > highestSeqFromInstance) {
              highestSeqFromInstance = seq;
            }
          }

          // Process only NEW lines (those beyond what we've already seen)
          // This correctly handles interleaved entries from different notes
          const newLines = lines.slice(lastSeenCount);

          for (const line of newLines) {
            const parts = line.split('|');
            if (parts.length < 2) continue; // Invalid line

            const noteId = parts[0];
            const instanceSeq = parts[1];
            if (!noteId || !instanceSeq) continue;

            const seqParts = instanceSeq.split('_');
            const sequence = parseInt(seqParts[1] ?? '0');

            // STALE DETECTION: Check if this entry is too far behind the highest sequence
            const gap = highestSeqFromInstance - sequence;
            if (gap > STALE_SEQUENCE_GAP_THRESHOLD) {
              // Check if this entry was previously skipped by the user
              if (this.isSkipped(noteId, otherInstanceId)) {
                // User already skipped this - don't show it again
                continue;
              }

              console.warn(
                `[ActivitySync] Stale entry detected: note ${noteId} at seq ${sequence}, highest from ${otherInstanceId} is ${highestSeqFromInstance} (gap=${gap})`
              );
              // Track this stale entry for UI display
              // Avoid duplicates
              const existingStale = this.staleEntries.find(
                (e) => e.noteId === noteId && e.sourceInstanceId === otherInstanceId
              );
              if (!existingStale) {
                this.staleEntries.push({
                  noteId,
                  sourceInstanceId: otherInstanceId,
                  expectedSequence: sequence,
                  highestSequenceFromInstance: highestSeqFromInstance,
                  gap,
                  detectedAt: Date.now(),
                });
              }
              // Skip syncing this stale entry - it will never arrive
              continue;
            }

            affectedNotes.add(noteId);

            // Track the highest sequence we need to sync to for this note
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

          // Update line count watermark after processing
          // Note: We update this immediately because line count tracking is independent
          // of whether the CRDT files have synced yet. The pollAndReload will handle
          // waiting for CRDT files to arrive.
          if (lines.length > lastSeenCount) {
            this.lastSeenLineCount.set(otherInstanceId, lines.length);
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
   * @param _otherInstanceId The instance ID whose activity we're syncing from (unused, kept for docs)
   */
  private startSyncChain(noteId: string, _otherInstanceId: string): void {
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

      // Note: Line count watermark is already updated in syncFromOtherInstances
      // The pollAndReload handles waiting for CRDT files to arrive
      if (success) {
        console.log(
          `[ActivitySync] Successfully synced note ${noteId} to sequence ${target.sequence}`
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

    // Check if this entry was skipped by the user (stale sync they chose to ignore)
    if (this.isSkipped(noteId, sourceInstanceId)) {
      console.log(
        `[ActivitySync] Entry for note ${noteId} from ${sourceInstanceId} was skipped by user, aborting sync`
      );
      return true; // Return true to update watermark and skip this entry
    }

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
      // Check if skipped between retry attempts (user may have skipped during polling)
      if (this.isSkipped(noteId, sourceInstanceId)) {
        console.log(
          `[ActivitySync] Entry for note ${noteId} from ${sourceInstanceId} was skipped during retry, aborting sync`
        );
        return true;
      }
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
   * Clean up our own stale activity log entries
   *
   * This is "self-healing" - when we detect our own broken promises (entries
   * that reference sequences far behind our current sequence), we can safely
   * remove them since they will never be fulfilled.
   *
   * @returns Array of cleaned entries (noteId, sequence pairs)
   */
  async cleanupOwnStaleEntries(): Promise<Array<{ noteId: string; sequence: number }>> {
    const cleaned: Array<{ noteId: string; sequence: number }> = [];

    try {
      const filePath = this.fs.joinPath(this.activityDir, `${this.instanceId}.log`);

      // Check if our activity log exists
      const exists = await this.fs.exists(filePath);
      if (!exists) {
        return cleaned;
      }

      const data = await this.fs.readFile(filePath);
      const content = new TextDecoder().decode(data);

      // Parse lines
      const allLines = content.split('\n');
      const hasTrailingNewline = content.endsWith('\n');
      const lines = hasTrailingNewline
        ? allLines.filter((l) => l.length > 0)
        : allLines.slice(0, -1).filter((l) => l.length > 0);

      if (lines.length === 0) {
        return cleaned;
      }

      // Find highest sequence in our log
      let highestSeq = 0;
      for (const line of lines) {
        const parts = line.split('|');
        if (parts.length < 2) continue;
        const instanceSeq = parts[1];
        if (!instanceSeq) continue;
        const seqParts = instanceSeq.split('_');
        const seq = parseInt(seqParts[1] ?? '0');
        if (seq > highestSeq) {
          highestSeq = seq;
        }
      }

      // Filter out stale entries
      const nonStaleLines: string[] = [];
      for (const line of lines) {
        const parts = line.split('|');
        if (parts.length < 2) {
          nonStaleLines.push(line);
          continue;
        }

        const noteId = parts[0];
        const instanceSeq = parts[1];
        if (!noteId || !instanceSeq) {
          nonStaleLines.push(line);
          continue;
        }

        const seqParts = instanceSeq.split('_');
        const seq = parseInt(seqParts[1] ?? '0');
        const gap = highestSeq - seq;

        if (gap > STALE_SEQUENCE_GAP_THRESHOLD) {
          // This is a stale entry - clean it up
          console.log(
            `[ActivitySync] Self-healing own stale entry: note ${noteId} at seq ${seq} (gap=${gap})`
          );
          cleaned.push({ noteId, sequence: seq });
        } else {
          nonStaleLines.push(line);
        }
      }

      // Write compacted log if we removed any entries
      if (cleaned.length > 0) {
        const newContent = nonStaleLines.map((l) => l + '\n').join('');
        await this.fs.writeFile(filePath, new TextEncoder().encode(newContent));
        console.log(
          `[ActivitySync] Self-healed ${cleaned.length} stale entries, compacted log to ${nonStaleLines.length} entries`
        );
      }
    } catch (error) {
      console.error('[ActivitySync] Failed to cleanup own stale entries:', error);
    }

    return cleaned;
  }

  /**
   * Reset watermark tracking (useful for testing)
   */
  resetWatermarks(): void {
    this.lastSeenLineCount.clear();
  }

  /**
   * Get current watermarks (useful for debugging)
   * Returns instanceId -> line count processed
   */
  getWatermarks(): Map<string, number> {
    return new Map(this.lastSeenLineCount);
  }
}
