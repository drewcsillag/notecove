/**
 * Deletion Sync
 *
 * Synchronizes permanent deletions across multiple instances by reading other
 * instances' deletion logs and triggering local permanent deletes.
 *
 * Log format: {noteId}|{timestamp}\n
 */

import type { FileSystemAdapter } from './types';

export interface DeletionSyncCallbacks {
  /**
   * Permanently delete a note from the local database and CRDT manager.
   * This should NOT re-log the deletion (to avoid infinite loops).
   * Returns true if the note existed and was deleted, false if already gone.
   */
  processRemoteDeletion: (noteId: string) => Promise<boolean>;

  /**
   * Check if a note exists (hasn't been permanently deleted locally)
   */
  checkNoteExists?: (noteId: string) => Promise<boolean>;
}

export class DeletionSync {
  // Track which deletion entries we've already processed
  // Key: instanceId, Value: set of noteIds already processed from that instance
  private processedDeletions = new Map<string, Set<string>>();

  constructor(
    private fs: FileSystemAdapter,
    private instanceId: string,
    private deletionDir: string,
    private callbacks: DeletionSyncCallbacks
  ) {}

  /**
   * Sync deletions from other instances' deletion logs
   *
   * Returns a set of note IDs that were deleted during this sync.
   */
  async syncFromOtherInstances(): Promise<Set<string>> {
    const deletedNotes = new Set<string>();

    try {
      const files = await this.fs.listFiles(this.deletionDir);

      for (const file of files) {
        if (!file.endsWith('.log')) continue;

        const otherInstanceId = file.replace('.log', '');
        if (otherInstanceId === this.instanceId) continue; // Skip our own

        const filePath = this.fs.joinPath(this.deletionDir, file);

        try {
          const data = await this.fs.readFile(filePath);
          const content = new TextDecoder().decode(data);

          // IMPORTANT: Handle partial sync - ignore lines without trailing \n
          const allLines = content.split('\n');
          const hasTrailingNewline = content.endsWith('\n');
          const lines = hasTrailingNewline
            ? allLines.filter((l) => l.length > 0)
            : allLines.slice(0, -1).filter((l) => l.length > 0);

          if (lines.length === 0) continue;

          // Get or create the processed set for this instance
          let processed = this.processedDeletions.get(otherInstanceId);
          if (!processed) {
            processed = new Set<string>();
            this.processedDeletions.set(otherInstanceId, processed);
          }

          // Process new deletion entries
          for (const line of lines) {
            const parts = line.split('|');
            if (parts.length < 2) continue; // Invalid line

            const noteId = parts[0];
            if (!noteId) continue;

            // Skip if we've already processed this deletion
            if (processed.has(noteId)) continue;

            // Check if note still exists locally
            if (this.callbacks.checkNoteExists) {
              const exists = await this.callbacks.checkNoteExists(noteId);
              if (!exists) {
                // Note already deleted locally, just mark as processed
                processed.add(noteId);
                continue;
              }
            }

            console.log(
              `[DeletionSync] Processing remote deletion: note ${noteId} from instance ${otherInstanceId}`
            );

            // Process the deletion
            try {
              const wasDeleted = await this.callbacks.processRemoteDeletion(noteId);
              if (wasDeleted) {
                deletedNotes.add(noteId);
                console.log(`[DeletionSync] Successfully deleted note ${noteId}`);
              }
            } catch (error) {
              console.error(`[DeletionSync] Failed to delete note ${noteId}:`, error);
            }

            // Mark as processed regardless of success/failure to avoid retrying
            processed.add(noteId);
          }
        } catch (error) {
          // File might have been deleted or is corrupted
          console.error(`[DeletionSync] Failed to read ${file}:`, error);
        }
      }
    } catch (error) {
      // Directory might not exist yet
      if (!String(error).includes('ENOENT')) {
        console.error('[DeletionSync] Failed to sync from other instances:', error);
      }
    }

    return deletedNotes;
  }

  /**
   * Reset processed deletions tracking (useful for testing)
   */
  resetProcessed(): void {
    this.processedDeletions.clear();
  }

  /**
   * Get processed deletions (useful for debugging)
   */
  getProcessedDeletions(): Map<string, Set<string>> {
    return new Map(Array.from(this.processedDeletions.entries()).map(([k, v]) => [k, new Set(v)]));
  }
}
