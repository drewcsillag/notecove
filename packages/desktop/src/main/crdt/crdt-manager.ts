/**
 * CRDT Manager Implementation
 *
 * Manages in-memory Yjs documents for notes.
 * All renderer windows connect to the same in-memory document via IPC.
 */

import * as Y from 'yjs';
import type { CRDTManager, DocumentState } from './types';
import { NoteDoc, FolderTreeDoc } from '@shared/crdt';
import { DocumentSnapshot } from '@shared/storage';
import type { AppendLogManager } from '@shared/storage';
import type { UUID, FolderData } from '@shared/types';
import type { Database } from '@notecove/shared';
import { getCRDTMetrics } from '../telemetry/crdt-metrics';

export class CRDTManagerImpl implements CRDTManager {
  private documents = new Map<string, DocumentState>();
  private folderTrees = new Map<string, FolderTreeDoc>();
  private activityLoggers = new Map<string, import('@shared/storage').ActivityLogger>();
  private snapshotCheckTimer: NodeJS.Timeout | undefined;
  // Track pending update writes for graceful shutdown
  private pendingUpdates = new Set<Promise<void>>();
  // Callback to broadcast updates to renderer windows
  private broadcastCallback?: (noteId: string, update: Uint8Array) => void;

  constructor(
    private storageManager: AppendLogManager,
    private database?: Database
  ) {
    // Start periodic snapshot checker (every 10 minutes)
    this.startPeriodicSnapshotChecker();
    // Note: GC is deferred per STORAGE-FORMAT-DESIGN.md
  }

  /**
   * Set the broadcast callback for sending updates to renderer windows
   */
  setBroadcastCallback(callback: (noteId: string, update: Uint8Array) => void): void {
    this.broadcastCallback = callback;
  }

  /**
   * Broadcast an update to all renderer windows
   */
  private broadcastUpdate(noteId: string, update: Uint8Array): void {
    if (this.broadcastCallback) {
      this.broadcastCallback(noteId, update);
    }
  }

  async loadNote(noteId: string, sdId?: string): Promise<Y.Doc> {
    const existing = this.documents.get(noteId);

    if (existing) {
      // Document already loaded, increment ref count
      existing.refCount++;
      return existing.snapshot.getDoc();
    }

    // Track cold load time
    const loadStartTime = Date.now();

    // If sdId not provided, try to determine it from existing updates
    const noteSdId = sdId ?? (await this.getNoteSdId(noteId));

    // Load from storage (handles snapshots, logs, DB cache automatically)
    // Cache + vector clock system ensures convergence:
    // - Cached state is loaded first
    // - Then new log records (not covered by cached vector clock) are applied
    // - Result converges to the correct state
    let snapshot: DocumentSnapshot;

    try {
      const loadResult = await this.storageManager.loadNote(noteSdId, noteId);

      // Create snapshot from loaded state
      snapshot = DocumentSnapshot.fromStorage(
        Y.encodeStateAsUpdate(loadResult.doc),
        loadResult.vectorClock
      );
      loadResult.doc.destroy(); // Clean up the temporary doc

      console.log(`[CRDT Manager] Loaded note ${noteId} from storage`);
    } catch (error) {
      console.error(`Failed to load note ${noteId}:`, error);
      // Continue with empty snapshot
      snapshot = DocumentSnapshot.createEmpty();
    }

    // Create NoteDoc wrapper using the snapshot's doc
    const noteDoc = new NoteDoc(noteId, snapshot.getDoc());
    const doc = snapshot.getDoc();

    // Store document state
    const now = Date.now();
    this.documents.set(noteId, {
      snapshot,
      noteDoc,
      noteId,
      sdId: noteSdId,
      refCount: 1,
      lastModified: now,
      editCount: 0,
      lastSnapshotCheck: now,
      lastSnapshotCreated: now,
    });

    // Set up update listener to write changes to disk
    doc.on('update', (update: Uint8Array, origin: unknown) => {
      // Skip handling if this update came from reload (to avoid duplicate writes)
      // The updates from reload are already on disk, we just need to broadcast them
      if (origin === 'reload') {
        console.log(`[CRDT Manager] Skipping disk write for reload origin on note ${noteId}`);
        // Broadcast to renderer windows
        this.broadcastUpdate(noteId, update);
        return;
      }

      const updatePromise = this.handleUpdate(noteId, update)
        .catch((error: Error) => {
          console.error(`Failed to handle update for note ${noteId}:`, error);
        })
        .finally(() => {
          // Remove from pending set when complete
          this.pendingUpdates.delete(updatePromise);
        });

      // Track this update for graceful shutdown
      this.pendingUpdates.add(updatePromise);
    });

    // Record cold load metrics
    const loadDuration = Date.now() - loadStartTime;
    getCRDTMetrics().recordColdLoad(loadDuration, { note_id: noteId, sd_id: noteSdId });

    return doc;
  }

  async unloadNote(noteId: string): Promise<void> {
    const state = this.documents.get(noteId);

    if (!state) {
      return;
    }

    state.refCount--;

    // Only actually unload if no more windows are using it
    if (state.refCount <= 0) {
      // Check if we should create a snapshot before unloading
      await this.checkAndCreateSnapshot(noteId);

      state.snapshot.destroy();
      this.documents.delete(noteId);
    }
  }

  async applyUpdate(noteId: string, update: Uint8Array): Promise<void> {
    const state = this.documents.get(noteId);

    if (!state) {
      throw new Error(`Note ${noteId} not loaded`);
    }

    console.log(`[CRDT Manager] Applying update to note ${noteId}, size: ${update.length} bytes`);

    // Write update to disk first to get sequence information
    const writePromise = (async () => {
      try {
        // Write update to disk using the note's SD ID and get the save result
        const saveResult = await this.storageManager.writeNoteUpdate(state.sdId, noteId, update);

        // Apply update to snapshot with strict sequencing
        const instanceId = this.storageManager.getInstanceId();
        state.snapshot.applyUpdate(
          update,
          instanceId,
          saveResult.sequence,
          saveResult.offset,
          saveResult.file
        );

        const now = Date.now();
        state.lastModified = now;
        state.editCount++; // Track edits for adaptive snapshot frequency

        // Record activity for cross-instance sync using the correct SD's activity logger
        const activityLogger = this.activityLoggers.get(state.sdId);
        if (activityLogger) {
          try {
            console.log(
              `[CRDT Manager] Recording activity for note ${noteId} in SD ${state.sdId} (sequence: ${saveResult.sequence})`
            );
            await activityLogger.recordNoteActivity(noteId, saveResult.sequence);
          } catch (error) {
            // Don't let activity logging errors break the update
            console.error(`[CRDT Manager] Failed to record activity for note ${noteId}:`, error);
          }
        } else {
          console.warn(
            `[CRDT Manager] No activity logger found for SD ${state.sdId} when updating note ${noteId}`
          );
          console.warn(`[CRDT Manager] Available loggers:`, Array.from(this.activityLoggers.keys()));
        }
      } catch (error) {
        console.error(`Failed to handle update for note ${noteId}:`, error);
        throw error; // Re-throw to propagate error to caller
      }
    })();

    // Track this update for graceful shutdown
    this.pendingUpdates.add(writePromise);

    try {
      await writePromise;
      console.log(`[CRDT Manager] Update written to disk for note ${noteId}`);
    } finally {
      // Remove from pending set when complete
      this.pendingUpdates.delete(writePromise);
    }
  }

  getDocument(noteId: string): Y.Doc | undefined {
    return this.documents.get(noteId)?.snapshot.getDoc();
  }

  getNoteDoc(noteId: string): NoteDoc | undefined {
    return this.documents.get(noteId)?.noteDoc;
  }

  /**
   * Handle document update by writing to disk
   * Called when the doc emits 'update' event (user-generated changes)
   * Note: The update has already been applied to the doc, so we just record it
   */
  private async handleUpdate(noteId: string, update: Uint8Array): Promise<void> {
    const state = this.documents.get(noteId);

    if (!state) {
      return;
    }

    // Write update to disk using the note's SD ID and get the save result
    const saveResult = await this.storageManager.writeNoteUpdate(state.sdId, noteId, update);

    // Record that the update was already applied to the doc (via Y.Doc's 'update' event)
    // This updates the vector clock to match the doc's current state
    // CRITICAL: await this to ensure the vector clock update is part of the lock chain
    const instanceId = this.storageManager.getInstanceId();
    await state.snapshot.recordExternalUpdate(
      instanceId,
      saveResult.sequence,
      saveResult.offset,
      saveResult.file
    );

    const now = Date.now();
    state.lastModified = now;
    state.editCount++; // Track edits for adaptive snapshot frequency

    // Record activity for cross-instance sync using the correct SD's activity logger
    const activityLogger = this.activityLoggers.get(state.sdId);
    if (activityLogger) {
      try {
        console.log(
          `[CRDT Manager] Recording activity for note ${noteId} in SD ${state.sdId} (sequence: ${saveResult.sequence})`
        );
        await activityLogger.recordNoteActivity(noteId, saveResult.sequence);
      } catch (error) {
        // Don't let activity logging errors break the update
        console.error(`[CRDT Manager] Failed to record activity for note ${noteId}:`, error);
      }
    } else {
      console.warn(
        `[CRDT Manager] No activity logger found for SD ${state.sdId} when updating note ${noteId}`
      );
      console.warn(`[CRDT Manager] Available loggers:`, Array.from(this.activityLoggers.keys()));
    }
  }

  /**
   * Get all loaded document IDs
   */
  getLoadedNotes(): string[] {
    return Array.from(this.documents.keys());
  }

  /**
   * Reload a note from disk
   *
   * Re-reads all updates from disk and applies them to the in-memory document.
   * This is used for cross-instance synchronization.
   */
  async reloadNote(noteId: string): Promise<void> {
    console.log(`[CRDT Manager] reloadNote called for ${noteId}`);

    const state = this.documents.get(noteId);
    if (!state) {
      // Note not loaded, nothing to do
      console.log(`[CRDT Manager] Note ${noteId} not in documents, skipping reload`);
      console.log(`[CRDT Manager] Loaded notes: ${Array.from(this.documents.keys()).join(', ')}`);
      return;
    }

    try {
      // Log content before reload
      const beforeContent = state.snapshot.getDoc().getXmlFragment('content');
      console.log(`[CRDT Manager] Before reload, content length: ${beforeContent.length}`);

      // Load full state from storage and merge with in-memory doc
      // Cache + vector clock system ensures convergence - cached state + new log records
      const loadResult = await this.storageManager.loadNote(state.sdId, noteId);

      // Replace the entire snapshot atomically (doc + vector clock together)
      // This ensures they stay perfectly in sync
      const encodedState = Y.encodeStateAsUpdate(loadResult.doc);
      state.snapshot.replaceWith(encodedState, loadResult.vectorClock);
      loadResult.doc.destroy();

      // Broadcast the new state to renderer windows
      this.broadcastUpdate(noteId, encodedState);

      // Log content after reload
      const afterContent = state.snapshot.getDoc().getXmlFragment('content');
      console.log(
        `[CRDT Manager] After reload, content length: ${beforeContent.length} → ${afterContent.length}`
      );

      state.lastModified = Date.now();
    } catch (error) {
      console.error(`Failed to reload note ${noteId}:`, error);
      // Re-throw so ActivitySync can retry with exponential backoff
      throw error;
    }
  }

  /**
   * Set the activity logger for a specific SD
   *
   * This is called by the main process after initialization of each SD.
   */
  setActivityLogger(sdId: string, logger: import('@shared/storage').ActivityLogger): void {
    console.log(`[CRDT Manager] Registering activity logger for SD: ${sdId}`);
    this.activityLoggers.set(sdId, logger);
    console.log(`[CRDT Manager] Total activity loggers registered:`, this.activityLoggers.size);
  }

  /**
   * Load folder tree for an SD (async - waits for data to load from disk)
   */
  async loadFolderTree(sdId: string): Promise<FolderTreeDoc> {
    const existing = this.folderTrees.get(sdId);
    if (existing) {
      return existing;
    }

    // Create new FolderTreeDoc
    const folderTree = new FolderTreeDoc(sdId);

    // Set up update listener to write changes to disk
    folderTree.doc.on('update', (update: Uint8Array, origin: unknown) => {
      this.handleFolderUpdate(sdId, update, origin).catch((error: Error) => {
        console.error(`Failed to handle folder update for ${sdId}:`, error);
      });
    });

    this.folderTrees.set(sdId, folderTree);

    // Load updates from disk and wait for completion before returning
    // This ensures the folder tree is fully populated when returned to the caller
    await this.loadFolderTreeUpdates(sdId, folderTree);

    return folderTree;
  }

  /**
   * Load folder tree updates from disk
   */
  private async loadFolderTreeUpdates(sdId: string, folderTree: FolderTreeDoc): Promise<void> {
    try {
      // Load from storage (handles snapshots, logs, DB cache automatically)
      const loadResult = await this.storageManager.loadFolderTree(sdId);

      // Apply loaded state with 'load' origin to prevent triggering persistence
      Y.applyUpdate(folderTree.doc, Y.encodeStateAsUpdate(loadResult.doc), 'load');
      loadResult.doc.destroy();

      // Check if folder tree is empty (new installation)
      const folders = folderTree.getAllFolders();
      if (folders.length === 0 && sdId === 'default') {
        this.createDemoFolders(folderTree);
      }
    } catch (error) {
      console.error(`Failed to load folder tree updates for ${sdId}:`, error);
      // On error, create demo folders for default SD
      if (sdId === 'default') {
        this.createDemoFolders(folderTree);
      }
    }
  }

  /**
   * Handle folder tree update by writing to disk
   */
  private async handleFolderUpdate(
    sdId: string,
    update: Uint8Array,
    origin: unknown
  ): Promise<void> {
    // Don't persist updates that originated from loading (would create duplicate files)
    if (origin === 'load') {
      return;
    }

    // Write update to disk
    await this.storageManager.writeFolderUpdate(sdId, update);
  }

  /**
   * Get loaded folder tree
   */
  getFolderTree(sdId: string): FolderTreeDoc | undefined {
    return this.folderTrees.get(sdId);
  }

  /**
   * Create demo folders for testing (Phase 2.4.1 only)
   * TODO: Remove in Phase 2.4.2 when we have real folder creation
   */
  private createDemoFolders(folderTree: FolderTreeDoc): void {
    const folders: FolderData[] = [
      {
        id: 'folder-1' as UUID,
        name: 'Work',
        parentId: null,
        sdId: 'default',
        order: 0,
        deleted: false,
      },
      {
        id: 'folder-2' as UUID,
        name: 'Projects',
        parentId: 'folder-1' as UUID,
        sdId: 'default',
        order: 0,
        deleted: false,
      },
      {
        id: 'folder-3' as UUID,
        name: 'Personal',
        parentId: null,
        sdId: 'default',
        order: 1,
        deleted: false,
      },
      {
        id: 'folder-4' as UUID,
        name: 'Ideas',
        parentId: 'folder-3' as UUID,
        sdId: 'default',
        order: 0,
        deleted: false,
      },
      {
        id: 'folder-5' as UUID,
        name: 'Recipes',
        parentId: 'folder-3' as UUID,
        sdId: 'default',
        order: 1,
        deleted: false,
      },
    ];

    for (const folder of folders) {
      folderTree.createFolder(folder);
    }
  }

  /**
   * Get the SD ID for a note by querying the database
   * @param noteId Note ID
   * @returns SD ID or 'default' as fallback
   */
  private async getNoteSdId(noteId: string): Promise<string> {
    // Try to get from loaded document first (optimization)
    const state = this.documents.get(noteId);
    if (state?.sdId) {
      return state.sdId;
    }

    // Query database for the note's SD ID
    if (this.database) {
      try {
        const note = await this.database.getNote(noteId);
        if (note?.sdId) {
          return note.sdId;
        }
      } catch (error) {
        console.error(`[CRDT Manager] Failed to query database for note ${noteId}:`, error);
      }
    }

    // Fallback to default SD
    console.log(`[CRDT Manager] No sdId found for note ${noteId}, using 'default'`);
    return 'default';
  }

  /**
   * Start periodic snapshot checker
   * Checks all loaded notes every 10 minutes and creates snapshots if needed
   */
  private startPeriodicSnapshotChecker(): void {
    // Check every 10 minutes
    const intervalMs = 10 * 60 * 1000;

    this.snapshotCheckTimer = setInterval(() => {
      this.checkAllLoadedNotesForSnapshots().catch((error) => {
        console.error('[CRDT Manager] Error during periodic snapshot check:', error);
      });
    }, intervalMs);

    console.log('[CRDT Manager] Started periodic snapshot checker (every 10 minutes)');
  }

  /**
   * Check all loaded notes and create snapshots if needed
   */
  private async checkAllLoadedNotesForSnapshots(): Promise<void> {
    const noteIds = Array.from(this.documents.keys());

    if (noteIds.length === 0) {
      return;
    }

    console.log(`[CRDT Manager] Periodic snapshot check for ${noteIds.length} loaded notes`);

    for (const noteId of noteIds) {
      await this.checkAndCreateSnapshot(noteId);
    }
  }

  /**
   * Calculate adaptive snapshot threshold based on edit rate
   * High activity documents get more frequent snapshots
   */
  private calculateSnapshotThreshold(state: DocumentState): number {
    const now = Date.now();
    const timeSinceLastCheck = now - state.lastSnapshotCheck;
    const timeSinceLastSnapshot = now - state.lastSnapshotCreated;

    // Calculate edits per minute
    const minutesSinceCheck = timeSinceLastCheck / (60 * 1000);
    const editsPerMinute = minutesSinceCheck > 0 ? state.editCount / minutesSinceCheck : 0;

    // Adaptive thresholds based on edit rate:
    // - Very high activity (>10 edits/min): snapshot every 50 updates
    // - High activity (5-10 edits/min): snapshot every 100 updates
    // - Medium activity (1-5 edits/min): snapshot every 200 updates
    // - Low activity (<1 edit/min): snapshot every 500 updates
    // - Also snapshot if >30 minutes since last snapshot (catch idle documents)

    if (editsPerMinute > 10) {
      return 50; // Very active
    } else if (editsPerMinute > 5) {
      return 100; // High activity
    } else if (editsPerMinute > 1) {
      return 200; // Medium activity
    } else if (timeSinceLastSnapshot > 30 * 60 * 1000) {
      return 50; // Force snapshot for idle documents (>30 min)
    } else {
      return 500; // Low activity
    }
  }

  /**
   * Check if a note needs a snapshot and create one if needed
   * Saves to DB for fast loading on next startup
   * @param noteId Note ID
   */
  private async checkAndCreateSnapshot(noteId: string): Promise<void> {
    const state = this.documents.get(noteId);
    if (!state) {
      return;
    }

    try {
      // Calculate adaptive threshold based on edit rate
      const threshold = this.calculateSnapshotThreshold(state);

      // Check if we've exceeded the edit threshold since last snapshot
      if (state.editCount < threshold) {
        state.lastSnapshotCheck = Date.now();
        return;
      }

      console.log(`[CRDT Manager] Creating DB snapshot for note ${noteId}`);

      const snapshotStartTime = Date.now();

      // Get snapshot data (doc state and vector clock)
      // CRITICAL: await this to ensure doc and vector clock are captured atomically
      const { state: encodedState, vectorClock } = await state.snapshot.getSnapshot();

      console.log(`[CRDT Manager] Saving snapshot for ${noteId}, vector clock:`, vectorClock);

      // Save snapshot to DB using the encoded state we got atomically from getSnapshot()
      // This ensures the encoded state and vector clock are perfectly paired
      await this.storageManager.saveNoteSnapshot(
        state.sdId,
        noteId,
        encodedState,
        vectorClock
      );

      // Record snapshot creation metrics
      const now = Date.now();
      const snapshotDuration = now - snapshotStartTime;
      getCRDTMetrics().recordSnapshotCreation(snapshotDuration, {
        note_id: noteId,
        sd_id: state.sdId,
        edit_count: state.editCount,
        threshold,
      });

      console.log(
        `[CRDT Manager] DB snapshot saved (threshold: ${threshold}, edits: ${state.editCount})`
      );

      // Reset edit tracking
      state.editCount = 0;
      state.lastSnapshotCreated = now;
      state.lastSnapshotCheck = now;
    } catch (error) {
      console.error(`[CRDT Manager] Failed to create snapshot for note ${noteId}:`, error);
    }
  }

  /**
   * Flush all pending updates to disk
   * Should be called before destroy() during graceful shutdown
   */
  async flush(): Promise<void> {
    const pendingCount = this.pendingUpdates.size;
    if (pendingCount === 0) {
      console.log('[CRDT Manager] No pending updates to flush');
      return;
    }

    console.log(`[CRDT Manager] Flushing ${pendingCount} pending updates...`);
    const startTime = Date.now();

    // Wait for all pending update writes to complete
    await Promise.all(Array.from(this.pendingUpdates));

    const duration = Date.now() - startTime;
    console.log(`[CRDT Manager] Flushed all pending updates in ${duration}ms`);
  }

  /**
   * Get count of notes that have unsaved edits needing snapshots
   */
  getPendingSnapshotCount(): number {
    let count = 0;
    for (const state of this.documents.values()) {
      if (state.editCount > 0) {
        count++;
      }
    }
    return count;
  }

  /**
   * Create snapshots for all loaded documents with unsaved edits
   * Called during graceful shutdown to ensure all edits are persisted
   */
  async flushSnapshots(onProgress?: (current: number, total: number) => void): Promise<void> {
    // Collect notes that need snapshots (any edits since last snapshot)
    const notesNeedingSnapshots: string[] = [];
    for (const [noteId, state] of this.documents.entries()) {
      if (state.editCount > 0) {
        notesNeedingSnapshots.push(noteId);
      }
    }

    const total = notesNeedingSnapshots.length;
    if (total === 0) {
      console.log('[CRDT Manager] No notes need snapshots');
      return;
    }

    console.log(`[CRDT Manager] Creating shutdown snapshots for ${total} notes...`);

    for (let i = 0; i < notesNeedingSnapshots.length; i++) {
      const noteId = notesNeedingSnapshots[i];
      if (!noteId) continue;
      const state = this.documents.get(noteId);

      if (state) {
        try {
          // Report progress
          if (onProgress) {
            onProgress(i + 1, total);
          }

          console.log(
            `[CRDT Manager] Creating shutdown snapshot for note ${noteId} (${i + 1}/${total})`
          );

          // Get snapshot data
          const { vectorClock } = state.snapshot.getSnapshot();

          await this.storageManager.saveNoteSnapshot(
            state.sdId,
            noteId,
            state.snapshot.getDoc(),
            vectorClock
          );
          state.editCount = 0;
        } catch (error) {
          console.error(`[CRDT Manager] Failed to create shutdown snapshot for ${noteId}:`, error);
          // Continue with other notes
        }
      }
    }

    console.log(`[CRDT Manager] Completed shutdown snapshots for ${total} notes`);
  }

  /**
   * Clean up all documents
   */
  destroy(): void {
    // Stop periodic snapshot checker
    if (this.snapshotCheckTimer) {
      clearInterval(this.snapshotCheckTimer);
      this.snapshotCheckTimer = undefined;
      console.log('[CRDT Manager] Stopped periodic snapshot checker');
    }

    for (const state of this.documents.values()) {
      state.snapshot.destroy();
    }
    this.documents.clear();

    for (const folderTree of this.folderTrees.values()) {
      folderTree.destroy();
    }
    this.folderTrees.clear();
  }
}
