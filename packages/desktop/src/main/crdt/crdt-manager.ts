/**
 * CRDT Manager Implementation
 *
 * Manages in-memory Yjs documents for notes.
 * All renderer windows connect to the same in-memory document via IPC.
 */

import * as Y from 'yjs';
import type { CRDTManager, DocumentState } from './types';
import { NoteDoc, FolderTreeDoc } from '@shared/crdt';
import { shouldApplyUpdate, parseUpdateFilename } from '@shared/crdt';
import { DEFAULT_GC_CONFIG, type GCConfig } from '@shared/crdt';
import type { UpdateManager } from '@shared/storage';
import type { UUID, FolderData } from '@shared/types';
import type { Database } from '@notecove/shared';
import { getCRDTMetrics } from '../telemetry/crdt-metrics';

export class CRDTManagerImpl implements CRDTManager {
  private documents = new Map<string, DocumentState>();
  private folderTrees = new Map<string, FolderTreeDoc>();
  private activityLoggers = new Map<string, import('@shared/storage').ActivityLogger>();
  private snapshotCheckTimer: NodeJS.Timeout | undefined;
  private packingTimer: NodeJS.Timeout | undefined;
  private gcTimer: NodeJS.Timeout | undefined;
  // Track pending update writes for graceful shutdown
  private pendingUpdates = new Set<Promise<void>>();

  constructor(
    private updateManager: UpdateManager,
    private database?: Database
  ) {
    // Start periodic snapshot checker (every 10 minutes)
    this.startPeriodicSnapshotChecker();
    // Start periodic packing job (every 5 minutes)
    this.startPeriodicPacking();
    // Start periodic garbage collection (every 30 minutes)
    this.startPeriodicGC();
  }

  async loadNote(noteId: string, sdId?: string): Promise<Y.Doc> {
    const existing = this.documents.get(noteId);

    if (existing) {
      // Document already loaded, increment ref count
      existing.refCount++;
      return existing.doc;
    }

    // Track cold load time
    const loadStartTime = Date.now();

    // If sdId not provided, try to determine it from existing updates
    const noteSdId = sdId ?? (await this.getNoteSdId(noteId));

    // Create new Yjs document
    const noteDoc = new NoteDoc(noteId);
    const doc = noteDoc.doc;

    // Load from snapshot if available, otherwise fall back to loading all updates
    try {
      // Check for snapshots
      const snapshots = await this.updateManager.listSnapshotFiles(noteSdId, noteId);

      if (snapshots.length > 0) {
        // Use snapshot-based loading with error recovery
        let snapshotLoaded = false;

        // Try snapshots in order (best to worst) until one works
        for (const snapshotMeta of snapshots) {
          try {
            console.log(
              `[CRDT Manager] Attempting to load snapshot ${snapshotMeta.filename} (${snapshotMeta.totalChanges} changes)`
            );

            // Load the snapshot
            const snapshot = await this.updateManager.readSnapshot(
              noteSdId,
              noteId,
              snapshotMeta.filename
            );

            // Apply snapshot's document state
            Y.applyUpdate(doc, snapshot.documentState);

            console.log(
              `[CRDT Manager] Snapshot loaded successfully, now loading packs and remaining updates with vector clock filter`
            );

            let appliedCount = 0;
            let skippedCount = 0;

            // Load pack files first (filtered by vector clock)
            const packFiles = await this.updateManager.listPackFiles(noteSdId, noteId);
            let packUpdatesApplied = 0;

            for (const packMeta of packFiles) {
              try {
                // Check if this pack contains any updates we need
                // We need the pack if its endSeq > snapshot's maxSeq for this instance
                const maxSeqForInstance = snapshot.maxSequences[packMeta.instanceId] ?? -1;

                if (packMeta.endSeq <= maxSeqForInstance) {
                  // All updates in this pack are already in snapshot
                  console.log(
                    `[CRDT Manager] Skipping pack ${packMeta.filename} (all updates in snapshot)`
                  );
                  continue;
                }

                // Load the pack
                const pack = await this.updateManager.readPackFile(
                  noteSdId,
                  noteId,
                  packMeta.filename
                );

                // Apply updates from pack that aren't in snapshot
                for (const update of pack.updates) {
                  if (shouldApplyUpdate(snapshot.maxSequences, packMeta.instanceId, update.seq)) {
                    Y.applyUpdate(doc, update.data);
                    appliedCount++;
                    packUpdatesApplied++;
                  } else {
                    skippedCount++;
                  }
                }

                console.log(
                  `[CRDT Manager] Loaded pack ${packMeta.filename}: applied ${pack.updates.length} updates`
                );
              } catch (error) {
                console.error(
                  `[CRDT Manager] Failed to load pack file ${packMeta.filename}, skipping:`,
                  error
                );
              }
            }

            if (packFiles.length > 0) {
              console.log(
                `[CRDT Manager] Loaded ${packFiles.length} pack files (${packUpdatesApplied} updates)`
              );
            }

            // Load unpacked update files and filter based on vector clock
            const updateFiles = await this.updateManager.listNoteUpdateFiles(noteSdId, noteId);

            for (const updateFile of updateFiles) {
              try {
                const metadata = parseUpdateFilename(updateFile.filename);

                if (metadata?.sequence === undefined) {
                  // Old format without sequence numbers, skip
                  console.log(
                    `[CRDT Manager] Skipping update file without sequence: ${updateFile.filename}`
                  );
                  skippedCount++;
                  continue;
                }

                // Check if this update needs to be applied
                if (
                  shouldApplyUpdate(snapshot.maxSequences, metadata.instanceId, metadata.sequence)
                ) {
                  // Apply this update (not in snapshot or packs)
                  const update = await this.updateManager.readUpdateFile(updateFile.path);
                  Y.applyUpdate(doc, update);
                  appliedCount++;
                } else {
                  // Skip (already in snapshot)
                  skippedCount++;
                }
              } catch (error) {
                // Log error but continue with other update files
                console.error(
                  `[CRDT Manager] Failed to load update file ${updateFile.filename}, skipping:`,
                  error
                );
                skippedCount++;
              }
            }

            console.log(
              `[CRDT Manager] Applied ${appliedCount} total updates (${packUpdatesApplied} from packs, ${appliedCount - packUpdatesApplied} from individual files), skipped ${skippedCount} (already in snapshot or failed)`
            );

            snapshotLoaded = true;
            break; // Successfully loaded snapshot, exit loop
          } catch (error) {
            console.error(
              `[CRDT Manager] Failed to load snapshot ${snapshotMeta.filename}, trying next:`,
              error
            );
            // Continue to next snapshot
          }
        }

        // If all snapshots failed, fall back to loading all updates
        if (!snapshotLoaded) {
          console.warn(
            `[CRDT Manager] All snapshots failed for note ${noteId}, falling back to loading all updates`
          );
          const updates = await this.updateManager.readNoteUpdates(noteSdId, noteId);
          console.log(
            `[CRDT Manager] Fallback: loading note ${noteId} from ${updates.length} update files`
          );

          for (const update of updates) {
            try {
              Y.applyUpdate(doc, update);
            } catch (error) {
              console.error(`[CRDT Manager] Failed to apply update, skipping:`, error);
            }
          }
        }
      } else {
        // No snapshots available, load all updates (old behavior)
        const updates = await this.updateManager.readNoteUpdates(noteSdId, noteId);
        console.log(
          `[CRDT Manager] No snapshots found, loading note ${noteId} from ${updates.length} update files`
        );

        for (const update of updates) {
          try {
            Y.applyUpdate(doc, update);
          } catch (error) {
            console.error(`[CRDT Manager] Failed to apply update, skipping:`, error);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to load note ${noteId}:`, error);
      // Continue with empty document
    }

    // Store document state
    const now = Date.now();
    this.documents.set(noteId, {
      doc,
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
    doc.on('update', (update: Uint8Array) => {
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

    // Check if we should create a snapshot immediately after loading
    // (e.g., if note has 1000s of updates but no snapshot)
    this.checkAndCreateSnapshot(noteId).catch((error) => {
      console.error(`Failed to check/create snapshot for note ${noteId}:`, error);
    });

    // Record cold load metrics
    const loadDuration = Date.now() - loadStartTime;
    getCRDTMetrics().recordColdLoad(loadDuration, { note_id: noteId, sd_id: noteSdId });

    // Record file counts (async, don't block return)
    this.recordFileCountsAsync(noteSdId, noteId).catch((error) => {
      console.error(`Failed to record file counts for note ${noteId}:`, error);
    });

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

      state.doc.destroy();
      this.documents.delete(noteId);
    }
  }

  async applyUpdate(noteId: string, update: Uint8Array): Promise<void> {
    const state = this.documents.get(noteId);

    if (!state) {
      throw new Error(`Note ${noteId} not loaded`);
    }

    console.log(`[CRDT Manager] Applying update to note ${noteId}, size: ${update.length} bytes`);

    // Apply update to in-memory document
    Y.applyUpdate(state.doc, update);
    state.lastModified = Date.now();

    // Write update to disk (Y.applyUpdate doesn't trigger the 'update' event)
    const updatePromise = this.handleUpdate(noteId, update)
      .catch((error: Error) => {
        console.error(`Failed to handle update for note ${noteId}:`, error);
        throw error; // Re-throw to propagate error to caller
      })
      .finally(() => {
        // Remove from pending set when complete
        this.pendingUpdates.delete(updatePromise);
      });

    // Track this update for graceful shutdown
    this.pendingUpdates.add(updatePromise);

    await updatePromise;
    console.log(`[CRDT Manager] Update written to disk for note ${noteId}`);
  }

  getDocument(noteId: string): Y.Doc | undefined {
    return this.documents.get(noteId)?.doc;
  }

  getNoteDoc(noteId: string): NoteDoc | undefined {
    return this.documents.get(noteId)?.noteDoc;
  }

  /**
   * Handle document update by writing to disk
   */
  private async handleUpdate(noteId: string, update: Uint8Array): Promise<void> {
    const state = this.documents.get(noteId);

    if (!state) {
      return;
    }

    // Write update to disk using the note's SD ID and get the sequence number
    const sequenceNumber = await this.updateManager.writeNoteUpdate(state.sdId, noteId, update);

    const now = Date.now();
    state.lastModified = now;
    state.editCount++; // Track edits for adaptive snapshot frequency

    // Record activity for cross-instance sync using the correct SD's activity logger
    const activityLogger = this.activityLoggers.get(state.sdId);
    if (activityLogger) {
      try {
        console.log(
          `[CRDT Manager] Recording activity for note ${noteId} in SD ${state.sdId} (sequence: ${sequenceNumber})`
        );
        await activityLogger.recordNoteActivity(noteId, sequenceNumber);
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
    const state = this.documents.get(noteId);
    if (!state) {
      // Note not loaded, nothing to do
      return;
    }

    try {
      // Re-read all updates from disk using the note's SD ID
      const updates = await this.updateManager.readNoteUpdates(state.sdId, noteId);

      // Apply all updates (Yjs will automatically merge and deduplicate)
      for (const update of updates) {
        Y.applyUpdate(state.doc, update, 'reload');
      }

      state.lastModified = Date.now();
    } catch (error) {
      console.error(`Failed to reload note ${noteId}:`, error);
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
   * Load folder tree for an SD (synchronous, but loads from disk asynchronously in background)
   */
  loadFolderTree(sdId: string): FolderTreeDoc {
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

    // Load updates from disk (this will trigger the update listener, but we need
    // to temporarily disable it to avoid saving the loaded updates back to disk)
    this.loadFolderTreeUpdatesSync(sdId, folderTree);

    return folderTree;
  }

  /**
   * Synchronously load folder tree updates from disk
   */
  private loadFolderTreeUpdatesSync(sdId: string, folderTree: FolderTreeDoc): void {
    // Use setImmediate to load updates asynchronously but immediately
    setImmediate(() => {
      this.loadFolderTreeUpdates(sdId, folderTree).catch((err) => {
        console.error(`Failed to load folder tree updates for ${sdId}:`, err);
      });
    });
  }

  /**
   * Load folder tree updates from disk
   */
  private async loadFolderTreeUpdates(sdId: string, folderTree: FolderTreeDoc): Promise<void> {
    try {
      // Read updates for this specific SD only
      const updates = await this.updateManager.readFolderUpdates(sdId);

      // Apply all updates with 'load' origin to prevent triggering persistence
      for (const update of updates) {
        try {
          Y.applyUpdate(folderTree.doc, update, 'load');
        } catch (error) {
          console.error(`[CRDT Manager] Failed to apply folder tree update, skipping:`, error);
        }
      }

      // If no updates were found (new installation), create demo folders
      if (updates.length === 0 && sdId === 'default') {
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
    await this.updateManager.writeFolderUpdate(sdId, update);
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

      const shouldSnapshot = await this.updateManager.shouldCreateSnapshot(
        state.sdId,
        noteId,
        threshold // adaptive threshold based on document activity
      );

      if (shouldSnapshot) {
        console.log(`[CRDT Manager] Creating snapshot for note ${noteId}`);

        const snapshotStartTime = Date.now();

        // Build vector clock from existing update files
        const vectorClock = await this.updateManager.buildVectorClock(state.sdId, noteId);

        // Get full document state
        const documentState = Y.encodeStateAsUpdate(state.doc);

        // Write snapshot
        const filename = await this.updateManager.writeSnapshot(
          state.sdId,
          noteId,
          documentState,
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
          `[CRDT Manager] Snapshot created: ${filename} (threshold: ${threshold}, edits: ${state.editCount})`
        );

        // Reset edit tracking
        state.editCount = 0;
        state.lastSnapshotCreated = now;
      }

      // Update last snapshot check time
      state.lastSnapshotCheck = Date.now();
    } catch (error) {
      console.error(`[CRDT Manager] Failed to create snapshot for note ${noteId}:`, error);
    }
  }

  /**
   * Start periodic packing job
   * Checks all SDs every 5 minutes and packs old updates
   */
  private startPeriodicPacking(): void {
    // Check every 5 minutes
    const intervalMs = 5 * 60 * 1000;

    this.packingTimer = setInterval(() => {
      this.packAllNotes().catch((error) => {
        console.error('[CRDT Manager] Error during periodic packing:', error);
      });
    }, intervalMs);

    console.log('[CRDT Manager] Started periodic packing job (every 5 minutes)');
  }

  /**
   * Pack updates for all notes across all SDs
   */
  private async packAllNotes(): Promise<void> {
    // Get all unique SD IDs from loaded documents and activity loggers
    const sdIds = new Set<string>();

    // Add SD IDs from loaded documents
    for (const state of this.documents.values()) {
      sdIds.add(state.sdId);
    }

    // Add SD IDs from activity loggers
    for (const sdId of this.activityLoggers.keys()) {
      sdIds.add(sdId);
    }

    if (sdIds.size === 0) {
      return;
    }

    console.log(`[CRDT Manager] Periodic packing check for ${sdIds.size} SDs`);

    for (const sdId of sdIds) {
      await this.packNotesInSD(sdId);
    }
  }

  /**
   * Pack updates for all notes in a specific SD
   */
  private async packNotesInSD(sdId: string): Promise<void> {
    try {
      // List all notes in this SD
      const noteIds = await this.updateManager.listNotes(sdId);

      if (noteIds.length === 0) {
        return;
      }

      console.log(`[CRDT Manager] Packing check for ${noteIds.length} notes in SD ${sdId}`);

      for (const noteId of noteIds) {
        await this.packNote(sdId, noteId);
      }
    } catch (error) {
      console.error(`[CRDT Manager] Failed to pack notes in SD ${sdId}:`, error);
    }
  }

  /**
   * Pack updates for a single note
   *
   * Algorithm:
   * 1. List all update files for this note
   * 2. Group by instance ID
   * 3. For each instance, sort by sequence number
   * 4. Pack updates older than 5 minutes, keeping last 50 unpacked
   * 5. Only pack contiguous sequences (stop at first gap)
   */
  private async packNote(sdId: string, noteId: string): Promise<void> {
    try {
      // List all update files
      const updateFiles = await this.updateManager.listNoteUpdateFiles(sdId, noteId);

      if (updateFiles.length === 0) {
        return;
      }

      // Group by instance ID
      const updatesByInstance = new Map<
        string,
        { path: string; metadata: { seq: number; timestamp: number } }[]
      >();

      const now = Date.now();
      const fiveMinutesAgo = now - 5 * 60 * 1000;

      for (const updateFile of updateFiles) {
        const metadata = parseUpdateFilename(updateFile.filename);

        if (!metadata?.sequence) {
          // Old format or invalid, skip
          continue;
        }

        // Only consider updates older than 5 minutes
        if (metadata.timestamp > fiveMinutesAgo) {
          continue;
        }

        const instanceId = metadata.instanceId;
        const existing = updatesByInstance.get(instanceId) ?? [];
        existing.push({
          path: updateFile.path,
          metadata: {
            seq: metadata.sequence,
            timestamp: metadata.timestamp,
          },
        });
        updatesByInstance.set(instanceId, existing);
      }

      // Pack each instance's updates
      for (const [instanceId, updates] of updatesByInstance.entries()) {
        // Sort by sequence number
        updates.sort((a, b) => a.metadata.seq - b.metadata.seq);

        // Keep last 50 updates unpacked
        const minUnpacked = 50;
        if (updates.length <= minUnpacked) {
          // Not enough updates to pack
          continue;
        }

        const updatesToPack = updates.slice(0, updates.length - minUnpacked);

        // Find contiguous sequences (stop at first gap)
        const contiguous: typeof updatesToPack = [];
        let expectedSeq = updatesToPack[0]?.metadata.seq ?? 0;

        for (const update of updatesToPack) {
          if (update.metadata.seq !== expectedSeq) {
            // Gap found, stop here
            console.log(
              `[CRDT Manager] Gap detected in note ${noteId}, instance ${instanceId}: expected seq ${expectedSeq}, got ${update.metadata.seq}`
            );
            break;
          }
          contiguous.push(update);
          expectedSeq = expectedSeq + 1;
        }

        // Only pack if we have at least 10 contiguous updates (avoid tiny packs)
        if (contiguous.length < 10) {
          continue;
        }

        // Create the pack
        try {
          const packStartTime = Date.now();
          const filename = await this.updateManager.createPack(sdId, noteId, contiguous);
          const packDuration = Date.now() - packStartTime;

          // Record pack creation metrics
          getCRDTMetrics().recordPackCreation(packDuration, contiguous.length, {
            note_id: noteId,
            sd_id: sdId,
            instance_id: instanceId,
          });

          console.log(
            `[CRDT Manager] Created pack ${filename} for note ${noteId} (${contiguous.length} updates)`
          );
        } catch (error) {
          console.error(
            `[CRDT Manager] Failed to create pack for note ${noteId}, instance ${instanceId}:`,
            error
          );
        }
      }
    } catch (error) {
      console.error(`[CRDT Manager] Failed to pack note ${noteId}:`, error);
    }
  }

  /**
   * Start periodic garbage collection job (runs every 30 minutes)
   * @private
   */
  private startPeriodicGC(): void {
    const config: GCConfig = DEFAULT_GC_CONFIG;

    this.gcTimer = setInterval(() => {
      this.runGarbageCollection(config).catch((error) => {
        console.error('[CRDT Manager] GC job failed:', error);
      });
    }, config.gcInterval);

    console.log(`[CRDT Manager] Started periodic GC job (interval: ${config.gcInterval}ms)`);
  }

  /**
   * Run garbage collection across all notes in all SDs
   * @private
   */
  private async runGarbageCollection(config: GCConfig): Promise<void> {
    console.log('[CRDT Manager] Starting garbage collection...');

    try {
      // Get all unique SDs from loaded documents and activity loggers
      const sdIds = new Set<string>();

      // From loaded documents
      for (const state of this.documents.values()) {
        if (state.sdId) {
          sdIds.add(state.sdId);
        }
      }

      // From activity loggers
      for (const sdId of this.activityLoggers.keys()) {
        sdIds.add(sdId);
      }

      // Run GC on each SD
      for (const sdId of sdIds) {
        try {
          await this.gcNotesInSD(sdId, config);
        } catch (error) {
          console.error(`[CRDT Manager] GC failed for SD ${sdId}:`, error);
        }
      }

      console.log('[CRDT Manager] Garbage collection completed');
    } catch (error) {
      console.error('[CRDT Manager] GC failed:', error);
    }
  }

  /**
   * Run GC on all notes in a specific SD
   * @private
   */
  private async gcNotesInSD(sdId: string, config: GCConfig): Promise<void> {
    try {
      // Get all notes in this SD
      const noteIds = await this.updateManager.listNotes(sdId);

      console.log(`[CRDT Manager] Running GC on ${noteIds.length} notes in SD ${sdId}`);

      // Run GC on each note
      for (const noteId of noteIds) {
        try {
          await this.gcNote(sdId, noteId, config);
        } catch (error) {
          console.error(`[CRDT Manager] GC failed for note ${noteId}:`, error);
        }
      }
    } catch (error) {
      console.error(`[CRDT Manager] Failed to list notes in SD ${sdId}:`, error);
    }
  }

  /**
   * Run GC on a specific note
   * @private
   */
  private async gcNote(sdId: string, noteId: string, config: GCConfig): Promise<void> {
    try {
      const stats = await this.updateManager.runGarbageCollection(sdId, noteId, config);

      // Record GC metrics
      getCRDTMetrics().recordGC(
        {
          durationMs: stats.duration,
          filesDeleted: stats.totalFilesDeleted,
          bytesFreed: stats.diskSpaceFreed,
          errorCount: stats.errors.length,
        },
        { note_id: noteId, sd_id: sdId }
      );

      // Only log if we actually deleted something
      if (stats.totalFilesDeleted > 0) {
        console.log(
          `[CRDT Manager] GC for note ${noteId}: ` +
            `deleted ${stats.snapshotsDeleted} snapshots, ` +
            `${stats.packsDeleted} packs, ` +
            `${stats.updatesDeleted} updates ` +
            `(freed ${stats.diskSpaceFreed} bytes in ${stats.duration}ms)`
        );

        if (stats.errors.length > 0) {
          console.warn(`[CRDT Manager] GC errors for note ${noteId}:`, stats.errors);
        }
      }
    } catch (error) {
      console.error(`[CRDT Manager] Failed to run GC on note ${noteId}:`, error);
    }
  }

  /**
   * Record file counts for a note (async helper)
   * @private
   */
  private async recordFileCountsAsync(sdId: string, noteId: string): Promise<void> {
    try {
      const snapshots = await this.updateManager.listSnapshotFiles(sdId, noteId);
      const packs = await this.updateManager.listPackFiles(sdId, noteId);
      const updates = await this.updateManager.listNoteUpdateFiles(sdId, noteId);

      const total = snapshots.length + packs.length + updates.length;

      getCRDTMetrics().recordFileCounts(
        {
          total,
          snapshots: snapshots.length,
          packs: packs.length,
          updates: updates.length,
        },
        { note_id: noteId, sd_id: sdId }
      );
    } catch (error) {
      // Silent failure - don't interrupt normal operation
      console.error(`[CRDT Manager] Failed to record file counts for note ${noteId}:`, error);
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
   * Clean up all documents
   */
  destroy(): void {
    // Stop periodic snapshot checker
    if (this.snapshotCheckTimer) {
      clearInterval(this.snapshotCheckTimer);
      this.snapshotCheckTimer = undefined;
      console.log('[CRDT Manager] Stopped periodic snapshot checker');
    }

    // Stop periodic packing job
    if (this.packingTimer) {
      clearInterval(this.packingTimer);
      this.packingTimer = undefined;
      console.log('[CRDT Manager] Stopped periodic packing job');
    }

    // Stop periodic GC job
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = undefined;
      console.log('[CRDT Manager] Stopped periodic GC job');
    }

    for (const state of this.documents.values()) {
      state.doc.destroy();
    }
    this.documents.clear();

    for (const folderTree of this.folderTrees.values()) {
      folderTree.destroy();
    }
    this.folderTrees.clear();
  }
}
