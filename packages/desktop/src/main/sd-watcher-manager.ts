/**
 * SD Watcher Manager
 *
 * Manages file watchers, activity sync, and deletion sync for Storage Directories.
 * Encapsulates all the state and logic for monitoring and syncing changes across
 * multiple instances of the application.
 */

import { BrowserWindow } from 'electron';
import { join } from 'path';
import { existsSync } from 'fs';
import * as fs from 'fs/promises';
import * as Y from 'yjs';
import type { Database, PollingGroupStatus, PollingGroupSettings } from '@notecove/shared';
import {
  ActivityLogger,
  ActivitySync,
  DeletionLogger,
  DeletionSync,
  ImageStorage,
  isValidImageId,
  parseActivityFilename,
  PollingGroup,
} from '@notecove/shared';
import type { CRDTManager } from './crdt';
import type { AppendLogManager } from '@notecove/shared';
import { NodeFileSystemAdapter } from './storage/node-fs-adapter';
import { NodeFileWatcher } from './storage/node-file-watcher';
import { scanAndRegisterMedia } from './media-sync';
import { ProfilePresenceReader } from './profile-presence-reader';
import { reindexTagsForNotes } from './sd-watcher-helpers';
import { createActivitySyncCallbacks, createDeletionSyncCallbacks } from './sd-watcher-callbacks';

/**
 * Result of setting up SD watchers
 */
export interface SetupSDWatchersResult {
  /**
   * Function to run the initial sync. Can be awaited for blocking behavior
   * or called without await for background sync.
   */
  runInitialSync: () => Promise<void>;
}

/**
 * SD Watcher Manager
 *
 * Manages all watchers and sync state for Storage Directories
 */
export class SDWatcherManager {
  // Multi-SD support: Store watchers and activity syncs per SD
  private sdFileWatchers = new Map<string, NodeFileWatcher>();
  private sdActivityWatchers = new Map<string, NodeFileWatcher>();
  private sdActivitySyncs = new Map<string, ActivitySync>();
  private sdActivityLoggers = new Map<string, ActivityLogger>();
  private sdActivityPollIntervals = new Map<string, NodeJS.Timeout>();

  // Deletion sync support: track permanent deletions across instances
  private sdDeletionLoggers = new Map<string, DeletionLogger>();
  private sdDeletionSyncs = new Map<string, DeletionSync>();
  private sdDeletionWatchers = new Map<string, NodeFileWatcher>();
  private sdDeletionPollIntervals = new Map<string, NodeJS.Timeout>();

  // Media file watcher: detect when images arrive via sync
  private sdMediaWatchers = new Map<string, NodeFileWatcher>();

  private profilePresenceReader: ProfilePresenceReader | null = null;

  // Polling group for tier 2 persistent polling
  private pollingGroup: PollingGroup | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private fullRepollInterval: NodeJS.Timeout | null = null;
  private lastFullRepollAt = 0;
  private database: Database | null = null;

  // Active sync tracking: notes currently being synced (remote changes detected)
  private activeSyncs = new Map<string, Set<string>>(); // sdId -> Set<noteId>
  private onActiveSyncsChangedCallback: (() => void) | null = null;

  constructor(profilePresenceReader: ProfilePresenceReader | null = null) {
    this.profilePresenceReader = profilePresenceReader;
  }

  /**
   * Set callback to be called when active syncs change
   */
  setOnActiveSyncsChanged(callback: () => void): void {
    this.onActiveSyncsChangedCallback = callback;
  }

  /**
   * Add notes to active syncs (called when remote changes detected)
   */
  addActiveSyncs(sdId: string, noteIds: Set<string>): void {
    if (noteIds.size === 0) return;

    let sdSyncs = this.activeSyncs.get(sdId);
    if (!sdSyncs) {
      sdSyncs = new Set();
      this.activeSyncs.set(sdId, sdSyncs);
    }

    for (const noteId of noteIds) {
      sdSyncs.add(noteId);
    }

    this.onActiveSyncsChangedCallback?.();
  }

  /**
   * Remove notes from active syncs (called when sync completes)
   */
  removeActiveSyncs(sdId: string, noteIds: Set<string>): void {
    if (noteIds.size === 0) return;

    const sdSyncs = this.activeSyncs.get(sdId);
    if (!sdSyncs) return;

    for (const noteId of noteIds) {
      sdSyncs.delete(noteId);
    }

    if (sdSyncs.size === 0) {
      this.activeSyncs.delete(sdId);
    }

    this.onActiveSyncsChangedCallback?.();
  }

  /**
   * Get all active syncs as a flat array
   */
  getActiveSyncs(): { sdId: string; noteId: string }[] {
    const result: { sdId: string; noteId: string }[] = [];
    for (const [sdId, noteIds] of this.activeSyncs) {
      for (const noteId of noteIds) {
        result.push({ sdId, noteId });
      }
    }
    return result;
  }

  /**
   * Get count of active syncs
   */
  getActiveSyncCount(): number {
    let count = 0;
    for (const noteIds of this.activeSyncs.values()) {
      count += noteIds.size;
    }
    return count;
  }

  /**
   * Set the database reference (called during first SD setup)
   */
  setDatabase(database: Database): void {
    this.database = database;
  }

  /**
   * Initialize the polling group for tier 2 persistent polling
   */
  initPollingGroup(settings?: Partial<PollingGroupSettings>): void {
    if (this.pollingGroup) {
      console.warn('[SDWatcherManager] Polling group already initialized');
      return;
    }

    // Default settings
    const defaultSettings: PollingGroupSettings = {
      pollRatePerMinute: 120,
      hitRateMultiplier: 0.25,
      maxBurstPerSecond: 10,
      normalPriorityReserve: 0.2,
      recentEditWindowMs: 5 * 60 * 1000, // 5 minutes
      fullRepollIntervalMs: 30 * 60 * 1000, // 30 minutes
      fastPathMaxDelayMs: 60 * 1000, // 60 seconds
    };

    this.pollingGroup = new PollingGroup({ ...defaultSettings, ...settings });
    console.log('[SDWatcherManager] Polling group initialized');
  }

  /**
   * Get the polling group instance
   */
  getPollingGroup(): PollingGroup | null {
    return this.pollingGroup;
  }

  /**
   * Get polling group status for UI
   */
  getPollingGroupStatus(): PollingGroupStatus | null {
    if (!this.pollingGroup) return null;

    // Calculate time until next full repoll
    let nextFullRepollIn: number | null = null;
    const settings = this.pollingGroup.getSettings();
    const intervalMs = settings.fullRepollIntervalMs;

    if (intervalMs > 0 && this.lastFullRepollAt > 0) {
      const elapsed = Date.now() - this.lastFullRepollAt;
      const remaining = intervalMs - elapsed;
      nextFullRepollIn = Math.max(0, remaining);
    } else if (intervalMs <= 0) {
      nextFullRepollIn = null; // Disabled
    }

    return this.pollingGroup.getStatus(nextFullRepollIn);
  }

  /**
   * Start the polling group timer
   */
  startPollingGroup(): void {
    if (!this.pollingGroup) {
      console.warn('[SDWatcherManager] Cannot start polling group - not initialized');
      return;
    }

    if (this.pollingInterval) {
      console.warn('[SDWatcherManager] Polling group already running');
      return;
    }

    // Poll every 500ms to check if we should poll any notes
    this.pollingInterval = setInterval(() => {
      if (this.pollingGroup) {
        void this.runPollingGroupTick();
      }
    }, 500);

    console.log('[SDWatcherManager] Polling group timer started');
  }

  /**
   * Stop the polling group timer
   */
  stopPollingGroup(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('[SDWatcherManager] Polling group timer stopped');
    }
    // Also stop the full repoll timer
    this.stopFullRepollTimer();
  }

  /**
   * Run a full repoll of all notes in all SDs.
   * This adds all notes to the polling group with 'full-repoll' reason.
   * Each note will be polled once to check for any external changes.
   */
  async runFullRepoll(): Promise<void> {
    if (!this.pollingGroup) {
      console.warn('[SDWatcherManager] Cannot run full repoll - polling group not initialized');
      return;
    }

    if (!this.database) {
      console.warn('[SDWatcherManager] Cannot run full repoll - database not available');
      return;
    }

    console.log('[SDWatcherManager] Starting full repoll...');

    // Get all storage directories
    const allSDs = await this.database.getAllStorageDirs();
    let totalNotesAdded = 0;

    for (const sd of allSDs) {
      try {
        // Get all notes for this SD (non-deleted only)
        const notes = await this.database.getNotesBySd(sd.id);
        const activeNotes = notes.filter((note) => !note.deleted);

        for (const note of activeNotes) {
          this.pollingGroup.add({
            noteId: note.id,
            sdId: sd.id,
            expectedSequences: new Map(), // No specific sequences to wait for
            reason: 'full-repoll',
          });
        }

        totalNotesAdded += activeNotes.length;
        console.log(
          `[SDWatcherManager] Added ${activeNotes.length} notes from SD ${sd.id} to full repoll`
        );
      } catch (error) {
        console.error(
          `[SDWatcherManager] Error adding notes from SD ${sd.id} to full repoll:`,
          error
        );
      }
    }

    console.log(`[SDWatcherManager] Full repoll started with ${totalNotesAdded} total notes`);
  }

  /**
   * Start the full repoll timer for periodic repolling.
   * This schedules a full repoll at the configured interval.
   */
  startFullRepollTimer(): void {
    if (!this.pollingGroup) {
      console.warn(
        '[SDWatcherManager] Cannot start full repoll timer - polling group not initialized'
      );
      return;
    }

    if (this.fullRepollInterval) {
      console.warn('[SDWatcherManager] Full repoll timer already running');
      return;
    }

    const settings = this.pollingGroup.getSettings();
    const intervalMs = settings.fullRepollIntervalMs;

    // If interval is 0 or negative, full repoll is disabled
    if (intervalMs <= 0) {
      console.log('[SDWatcherManager] Full repoll disabled (interval = 0)');
      return;
    }

    // Record when we started (for calculating time until next repoll)
    this.lastFullRepollAt = Date.now();

    this.fullRepollInterval = setInterval(() => {
      this.lastFullRepollAt = Date.now();
      void this.runFullRepoll();
    }, intervalMs);

    console.log(
      `[SDWatcherManager] Full repoll timer started (interval: ${intervalMs / 1000 / 60} min)`
    );
  }

  /**
   * Stop the full repoll timer.
   */
  stopFullRepollTimer(): void {
    if (this.fullRepollInterval) {
      clearInterval(this.fullRepollInterval);
      this.fullRepollInterval = null;
      console.log('[SDWatcherManager] Full repoll timer stopped');
    }
  }

  /**
   * Run one tick of the polling group
   *
   * This triggers sync for each SD that has pending entries in the polling group.
   * The actual sync logic in ActivitySync will reload notes as needed.
   */
  private async runPollingGroupTick(): Promise<void> {
    if (!this.pollingGroup) return;

    // Get the next batch of entries to poll
    const batch = this.pollingGroup.getNextBatch(5);
    if (batch.length === 0) return;

    // Group by SD
    const entriesBySd = new Map<string, typeof batch>();
    for (const entry of batch) {
      let sdEntries = entriesBySd.get(entry.sdId);
      if (!sdEntries) {
        sdEntries = [];
        entriesBySd.set(entry.sdId, sdEntries);
      }
      sdEntries.push(entry);
    }

    // Trigger sync for each SD
    for (const [sdId, entries] of entriesBySd) {
      const activitySync = this.sdActivitySyncs.get(sdId);
      if (!activitySync) continue;

      try {
        // Trigger a full sync - this will reload any notes that have changes
        const reloadedNotes = await activitySync.syncFromOtherInstances();

        // Track active syncs for UI (only when actual changes detected)
        if (reloadedNotes.size > 0) {
          this.addActiveSyncs(sdId, reloadedNotes);
        }

        // Mark entries as polled, with hit if the note was reloaded
        for (const entry of entries) {
          const wasHit = reloadedNotes.has(entry.noteId);
          this.pollingGroup.markPolled(entry.noteId, entry.sdId, wasHit);
          this.pollingGroup.checkExitCriteria(entry.noteId, entry.sdId);
        }

        // Remove from active syncs after processing
        if (reloadedNotes.size > 0) {
          this.removeActiveSyncs(sdId, reloadedNotes);
        }
      } catch (err) {
        console.error(`[SDWatcherManager] Failed to poll SD ${sdId}:`, err);
      }
    }
  }

  /**
   * Update high-priority notes (open notes and notes in lists)
   */
  updateHighPriorityNotes(
    openNotes: { noteId: string; sdId: string }[],
    visibleNotes: { noteId: string; sdId: string }[]
  ): void {
    if (!this.pollingGroup) return;

    // Group by SD
    const openBySd = new Map<string, Set<string>>();
    const visibleBySd = new Map<string, Set<string>>();

    for (const note of openNotes) {
      let noteIds = openBySd.get(note.sdId);
      if (!noteIds) {
        noteIds = new Set();
        openBySd.set(note.sdId, noteIds);
      }
      noteIds.add(note.noteId);
    }

    for (const note of visibleNotes) {
      let noteIds = visibleBySd.get(note.sdId);
      if (!noteIds) {
        noteIds = new Set();
        visibleBySd.set(note.sdId, noteIds);
      }
      noteIds.add(note.noteId);
    }

    // Update polling group for each SD
    for (const [sdId, noteIds] of openBySd) {
      this.pollingGroup.setOpenNotes(sdId, noteIds);
    }

    for (const [sdId, noteIds] of visibleBySd) {
      this.pollingGroup.setNotesInLists(sdId, noteIds);
    }
  }

  /**
   * Add a note to the polling group (handoff from fast path)
   */
  addToPollingGroup(noteId: string, sdId: string, expectedSequences: Map<string, number>): void {
    if (!this.pollingGroup) {
      console.warn('[SDWatcherManager] Cannot add to polling group - not initialized');
      return;
    }

    this.pollingGroup.add({
      noteId,
      sdId,
      expectedSequences,
      reason: 'fast-path-handoff',
    });

    console.log(
      `[SDWatcherManager] Added note ${noteId} to polling group (handoff from fast path)`
    );
  }

  /**
   * Record that a note was recently edited locally.
   * This adds the note to the polling group with 'recent-edit' reason,
   * which gives it high priority for polling and keeps it in the group
   * for the configured recent edit window (default 5 minutes).
   */
  recordRecentEdit(noteId: string, sdId: string): void {
    if (!this.pollingGroup) {
      // Polling group may not be initialized yet during early startup
      return;
    }

    this.pollingGroup.add({
      noteId,
      sdId,
      expectedSequences: new Map(), // No specific sequences to wait for
      reason: 'recent-edit',
    });
  }

  /**
   * Get activity logger for a specific SD
   */
  getActivityLogger(sdId: string): ActivityLogger | undefined {
    return this.sdActivityLoggers.get(sdId);
  }

  /**
   * Get all activity loggers
   */
  getActivityLoggers(): Map<string, ActivityLogger> {
    return this.sdActivityLoggers;
  }

  /**
   * Get all activity syncs
   */
  getActivitySyncs(): Map<string, ActivitySync> {
    return this.sdActivitySyncs;
  }

  /**
   * Get all deletion syncs
   */
  getDeletionSyncs(): Map<string, DeletionSync> {
    return this.sdDeletionSyncs;
  }

  /**
   * Get deletion logger for a specific SD
   */
  getDeletionLogger(sdId: string): DeletionLogger | undefined {
    return this.sdDeletionLoggers.get(sdId);
  }

  /**
   * Get all deletion loggers
   */
  getDeletionLoggers(): Map<string, DeletionLogger> {
    return this.sdDeletionLoggers;
  }

  /**
   * Set up file watchers and activity sync for a Storage Directory.
   * Returns an object with a runInitialSync function that performs the initial sync.
   * This allows the caller to decide whether to block on sync or run it in background.
   */
  async setupSDWatchers(
    sdId: string,
    sdPath: string,
    fsAdapter: NodeFileSystemAdapter,
    profileId: string,
    instanceId: string,
    storageManager: AppendLogManager,
    crdtManager: CRDTManager,
    db: Database
  ): Promise<SetupSDWatchersResult> {
    console.log(`[Init] Setting up watchers for SD: ${sdId} at ${sdPath}`);

    const folderLogsPath = join(sdPath, 'folders', 'logs');
    const activityDir = join(sdPath, 'activity');
    const deletionDir = join(sdPath, 'deleted');

    // Create and initialize ActivityLogger for this SD
    const activityLogger = new ActivityLogger(fsAdapter, activityDir);
    activityLogger.setIds(profileId, instanceId);
    await activityLogger.initialize();

    // Register the activity logger with CRDT Manager
    // Type assertion needed due to TypeScript module resolution quirk between dist and src
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    crdtManager.setActivityLogger(sdId, activityLogger as any);

    // Store logger for periodic compaction
    this.sdActivityLoggers.set(sdId, activityLogger);

    // Create and initialize DeletionLogger for this SD
    const deletionLogger = new DeletionLogger(fsAdapter, deletionDir);
    deletionLogger.setIds(profileId, instanceId);
    await deletionLogger.initialize();
    this.sdDeletionLoggers.set(sdId, deletionLogger);

    // Create ActivitySync for this SD
    const activitySyncCallbacks = createActivitySyncCallbacks({
      sdId,
      sdPath,
      crdtManager,
      database: db,
    });

    const activitySync = new ActivitySync(
      fsAdapter,
      instanceId,
      activityDir,
      sdId,
      activitySyncCallbacks
    );
    activitySync.setProfileId(profileId);

    // Clean up orphaned activity logs on startup
    await activitySync.cleanupOrphanedLogs();

    // Store the ActivitySync instance
    this.sdActivitySyncs.set(sdId, activitySync);

    // Create DeletionSync for this SD
    const deletionSyncCallbacks = createDeletionSyncCallbacks({
      sdId,
      crdtManager,
      database: db,
    });

    const deletionSync = new DeletionSync(
      fsAdapter,
      instanceId,
      deletionDir,
      deletionSyncCallbacks
    );
    deletionSync.setProfileId(profileId);

    // Store the DeletionSync instance
    this.sdDeletionSyncs.set(sdId, deletionSync);

    // Set up deletion watcher
    const deletionWatcher = new NodeFileWatcher();
    await deletionWatcher.watch(deletionDir, (event) => {
      console.log(`[DeletionWatcher ${sdId}] Detected deletion log change:`, event.filename);

      // Ignore our own log file (we write to it, don't need to read it)
      if (event.filename === `${instanceId}.log`) {
        return;
      }

      // Only process .log files
      if (!event.filename.endsWith('.log')) {
        return;
      }

      // Sync deletions from other instances
      void (async () => {
        try {
          const deletedNotes = await deletionSync.syncFromOtherInstances();
          if (deletedNotes.size > 0) {
            console.log(
              `[DeletionWatcher ${sdId}] Synced ${deletedNotes.size} deletions:`,
              Array.from(deletedNotes)
            );
          }
        } catch (error) {
          console.error(`[DeletionWatcher ${sdId}] Sync failed:`, error);
        }
      })();
    });

    this.sdDeletionWatchers.set(sdId, deletionWatcher);

    // Set up deletion polling (backup for file watcher failures)
    const deletionPollInterval = setInterval(
      () => {
        void (async () => {
          try {
            await deletionSync.syncFromOtherInstances();
          } catch (error) {
            // Don't log ENOENT - directory might not exist yet
            if (!String(error).includes('ENOENT')) {
              console.error(`[DeletionSync Poll ${sdId}] Poll failed:`, error);
            }
          }
        })();
      },
      10000 // Poll every 10 seconds
    );

    this.sdDeletionPollIntervals.set(sdId, deletionPollInterval);

    // Initial deletion sync on startup
    void deletionSync.syncFromOtherInstances().catch((error) => {
      console.error(`[DeletionSync ${sdId}] Initial sync failed:`, error);
    });

    // Set up folder logs watcher (new format uses .crdtlog files)
    const folderWatcher = new NodeFileWatcher();
    await folderWatcher.watch(folderLogsPath, (event) => {
      console.log(`[FileWatcher ${sdId}] Detected folder log file change:`, event.filename);

      // Ignore directory creation events and temporary files
      if (event.filename === 'logs' || event.filename.endsWith('.tmp')) {
        return;
      }

      // Only process .crdtlog files
      if (!event.filename.endsWith('.crdtlog')) {
        return;
      }

      // Reload folder tree from disk using storage manager
      const folderTree = crdtManager.getFolderTree(sdId);
      if (folderTree) {
        storageManager
          .loadFolderTree(sdId)
          .then((result) => {
            // Apply loaded state to folder tree
            Y.applyUpdate(folderTree.doc, Y.encodeStateAsUpdate(result.doc), 'external-sync');
            result.doc.destroy();

            // Broadcast update to all windows
            const windows = BrowserWindow.getAllWindows();
            for (const window of windows) {
              window.webContents.send('folder:updated', {
                sdId,
                operation: 'external-sync',
                folderId: 'unknown',
              });
            }
          })
          .catch((err) => {
            console.error(`[FileWatcher ${sdId}] Failed to reload folder tree:`, err);
          });
      }
    });

    this.sdFileWatchers.set(sdId, folderWatcher);

    // Set up activity watcher with startup grace period
    let startupComplete = false;
    const activityWatcher = new NodeFileWatcher();
    await activityWatcher.watch(activityDir, (event) => {
      console.log(`[ActivityWatcher ${sdId}] Detected activity log change:`, event.filename);

      // Broadcast to renderer for test instrumentation
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send('test:file-watcher-event', {
          sdId,
          filename: event.filename,
          type: 'activity',
          gracePeriodActive: !startupComplete,
        });
      }

      // Ignore events during startup to prevent duplicate imports
      // The initial sync (line 663) handles startup properly
      if (!startupComplete) {
        console.log(
          `[ActivityWatcher ${sdId}] Ignoring event during startup grace period:`,
          event.filename
        );
        // Broadcast for test debugging
        for (const window of BrowserWindow.getAllWindows()) {
          window.webContents.send('test:activity-watcher-debug', {
            sdId,
            filename: event.filename,
            reason: 'grace-period',
          });
        }
        return;
      }

      // Only process .log files
      if (!event.filename.endsWith('.log')) {
        console.log(`[ActivityWatcher ${sdId}] Ignoring non-.log file:`, event.filename);
        // Broadcast for test debugging
        for (const window of BrowserWindow.getAllWindows()) {
          window.webContents.send('test:activity-watcher-debug', {
            sdId,
            filename: event.filename,
            reason: 'not-log-file',
          });
        }
        return;
      }

      // Ignore directory creation events
      if (event.filename === '.activity') {
        console.log(`[ActivityWatcher ${sdId}] Ignoring directory event:`, event.filename);
        return;
      }

      // Parse the filename to check if it's our own log file
      // Format: {profileId}_{instanceId}.log or {instanceId}.log (old format)
      const parsed = parseActivityFilename(event.filename);
      if (parsed) {
        const isOwnFile =
          parsed.instanceId === instanceId ||
          (parsed.profileId !== null && parsed.profileId === profileId);
        if (isOwnFile) {
          console.log(
            `[ActivityWatcher ${sdId}] Ignoring own log file:`,
            event.filename,
            `(parsed: instanceId=${parsed.instanceId}, profileId=${parsed.profileId})`
          );
          // Broadcast for test debugging
          for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send('test:activity-watcher-debug', {
              sdId,
              filename: event.filename,
              reason: 'own-log',
              instanceId,
              profileId,
              parsedInstanceId: parsed.instanceId,
              parsedProfileId: parsed.profileId,
            });
          }
          return;
        }
      }

      // Sync from other instances
      void (async () => {
        try {
          // Broadcast that we're starting sync
          for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send('test:activity-watcher-debug', {
              sdId,
              filename: event.filename,
              reason: 'starting-sync',
            });
          }

          console.log(`[ActivitySync ${sdId}] Starting sync from other instances...`);
          const affectedNotes = await activitySync.syncFromOtherInstances();
          console.log(
            `[ActivitySync ${sdId}] Sync complete, affected notes:`,
            affectedNotes.size,
            Array.from(affectedNotes)
          );

          // Track active syncs for UI (only when actual changes detected)
          if (affectedNotes.size > 0) {
            this.addActiveSyncs(sdId, affectedNotes);
          }

          // Wait for all pending syncs to complete before broadcasting
          // This ensures CRDT state is up-to-date when renderers reload
          await activitySync.waitForPendingSyncs();

          // Reindex tags for affected notes
          if (affectedNotes.size > 0) {
            await reindexTagsForNotes(affectedNotes, crdtManager, db);
          }

          // Broadcast updates to all windows for affected notes
          if (affectedNotes.size > 0) {
            const noteIds = Array.from(affectedNotes);
            console.log(
              `[ActivitySync ${sdId}] Broadcasting to ${BrowserWindow.getAllWindows().length} windows`
            );
            for (const window of BrowserWindow.getAllWindows()) {
              window.webContents.send('note:external-update', {
                operation: 'sync',
                noteIds,
              });
            }

            // Broadcast to test instrumentation
            for (const window of BrowserWindow.getAllWindows()) {
              window.webContents.send('test:activity-sync-complete', {
                sdId,
                noteIds,
              });
            }

            // Remove from active syncs after processing
            this.removeActiveSyncs(sdId, affectedNotes);
          } else {
            console.log(`[ActivitySync ${sdId}] No affected notes to broadcast`);
            // Broadcast that there were no affected notes
            for (const window of BrowserWindow.getAllWindows()) {
              window.webContents.send('test:activity-watcher-debug', {
                sdId,
                filename: event.filename,
                reason: 'no-affected-notes',
              });
            }
          }
        } catch (error) {
          console.error(`[ActivityWatcher ${sdId}] Failed to sync from other instances:`, error);
          // Broadcast the error for debugging
          for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send('test:activity-watcher-debug', {
              sdId,
              filename: event.filename,
              reason: 'sync-error',
              error: String(error),
            });
          }
        }
      })();
    });

    this.sdActivityWatchers.set(sdId, activityWatcher);

    // Set up media watcher for image sync detection
    const mediaDir = `${sdPath}/media`;
    const mediaWatcher = new NodeFileWatcher();

    // Only watch if media directory exists
    if (existsSync(mediaDir)) {
      await mediaWatcher.watch(mediaDir, (event) => {
        // Extract imageId from filename (e.g., "abc123.png" → "abc123")
        const filename = event.filename;
        const lastDotIndex = filename.lastIndexOf('.');
        if (lastDotIndex === -1) return; // No extension, not an image

        const imageId = filename.substring(0, lastDotIndex);
        const extension = filename.substring(lastDotIndex + 1).toLowerCase();

        // Only handle image files
        const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic', 'heif'];
        if (!imageExtensions.includes(extension)) return;

        // Validate imageId format (security)
        if (!isValidImageId(imageId)) {
          console.log(`[MediaWatcher ${sdId}] Ignoring invalid imageId format:`, imageId);
          return;
        }

        console.log(`[MediaWatcher ${sdId}] Image file available:`, { imageId, filename });

        // Register image in database (async, non-blocking)
        const mimeType = ImageStorage.getMimeTypeFromExtension(extension);
        if (mimeType) {
          const filePath = `${mediaDir}/${filename}`;
          fs.stat(filePath)
            .then((stats) => {
              return db.upsertImage({
                id: imageId,
                sdId,
                filename,
                mimeType,
                width: null,
                height: null,
                size: stats.size,
                created: Date.now(),
              });
            })
            .then(() => {
              console.log(`[MediaWatcher ${sdId}] Registered synced image:`, { imageId, filename });
            })
            .catch((err: unknown) => {
              // File may have been deleted or moved, ignore
              console.log(`[MediaWatcher ${sdId}] Failed to register image:`, imageId, err);
            });
        }

        // Broadcast to all renderer windows
        for (const window of BrowserWindow.getAllWindows()) {
          window.webContents.send('image:available', {
            sdId,
            imageId,
            filename,
          });
        }
      });
      this.sdMediaWatchers.set(sdId, mediaWatcher);
      console.log(`[Init] Media watcher set up for SD: ${sdId}`);
    } else {
      console.log(`[Init] Media directory doesn't exist yet for SD: ${sdId}, skipping watcher`);
    }

    // Background scan for synced images (non-blocking)
    void scanAndRegisterMedia(sdId, sdPath, db)
      .then((count) => {
        if (count > 0) {
          console.log(`[Init] Discovered ${count} synced images in SD: ${sdId}`);
        }
      })
      .catch((error) => {
        console.error(`[Init] Failed to scan media for SD ${sdId}:`, error);
      });

    console.log(`[Init] Watchers set up successfully for SD: ${sdId}`);

    // Read and cache profile presence files from this SD
    // This enables the Stale Sync UI to show meaningful device names
    if (this.profilePresenceReader) {
      try {
        const presences = await this.profilePresenceReader.readAllPresenceFiles(sdPath, sdId);
        console.log(`[Init] Cached ${presences.length} profile presence files for SD: ${sdId}`);
      } catch (error) {
        console.error(`[Init] Failed to read profile presence files for SD: ${sdId}`, error);
      }
    }

    // Return a function that performs the initial sync
    // This allows the caller to decide whether to await it (blocking) or run in background
    return {
      runInitialSync: async () => {
        // Perform initial sync from other instances on startup
        console.log(`[Init] Performing initial sync from other instances for SD: ${sdId}`);
        try {
          const affectedNotes = await activitySync.syncFromOtherInstances();

          // Track active syncs for UI (only when actual changes detected)
          if (affectedNotes.size > 0) {
            this.addActiveSyncs(sdId, affectedNotes);
          }

          // Wait for all pending syncs to complete before broadcasting
          await activitySync.waitForPendingSyncs();

          console.log(
            `[Init] Initial sync complete for SD: ${sdId}, affected notes:`,
            affectedNotes.size
          );

          // Reindex tags for affected notes
          if (affectedNotes.size > 0) {
            await reindexTagsForNotes(affectedNotes, crdtManager, db);
          }

          // Broadcast updates to all windows for affected notes
          if (affectedNotes.size > 0) {
            const noteIds = Array.from(affectedNotes);
            for (const window of BrowserWindow.getAllWindows()) {
              window.webContents.send('note:external-update', {
                operation: 'sync',
                noteIds,
              });
            }

            // Remove from active syncs after processing
            this.removeActiveSyncs(sdId, affectedNotes);
          }
        } catch (error) {
          console.error(`[Init] Failed to perform initial sync for SD: ${sdId}:`, error);
        } finally {
          // Mark startup as complete to allow file watcher to process subsequent changes
          // This prevents race conditions where file watcher triggers during initial sync
          startupComplete = true;
          console.log(`[Init] Startup grace period ended for SD: ${sdId}`);

          // Broadcast to renderer for test instrumentation
          for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send('test:grace-period-ended', { sdId });
          }

          // Broadcast sync complete for UI status tracking
          for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send('sync:initial-sync-complete', { sdId });
          }
        }

        // Set up polling backup for activity sync AFTER initial sync completes
        // Chokidar may miss/coalesce rapid file changes, so poll every 3 seconds as backup
        let pollCount = 0;
        const pollInterval = setInterval(() => {
          void (async () => {
            pollCount++;
            try {
              // Log watermarks every 10th poll (30 seconds) for debugging
              if (pollCount % 10 === 0) {
                const watermarks = activitySync.getWatermarks();
                console.log(
                  `[ActivitySync Poll ${sdId}] Watermarks:`,
                  Object.fromEntries(watermarks)
                );
              }

              const affectedNotes = await activitySync.syncFromOtherInstances();

              if (affectedNotes.size > 0) {
                // Track active syncs for UI
                this.addActiveSyncs(sdId, affectedNotes);

                console.log(
                  `[ActivitySync Poll ${sdId}] Found changes via poll:`,
                  Array.from(affectedNotes)
                );
                // Also log watermarks when changes found
                console.log(
                  `[ActivitySync Poll ${sdId}] Watermarks after sync:`,
                  Object.fromEntries(activitySync.getWatermarks())
                );

                // Wait for pending syncs to complete
                await activitySync.waitForPendingSyncs();

                // Reindex tags for affected notes
                await reindexTagsForNotes(affectedNotes, crdtManager, db);

                // Broadcast updates to all windows
                const noteIds = Array.from(affectedNotes);
                for (const window of BrowserWindow.getAllWindows()) {
                  window.webContents.send('note:external-update', {
                    operation: 'sync',
                    noteIds,
                  });
                }

                // Remove from active syncs after processing
                this.removeActiveSyncs(sdId, affectedNotes);
              }
            } catch (error) {
              // Don't log every poll failure, just errors
              if (!String(error).includes('ENOENT')) {
                console.error(`[ActivitySync Poll ${sdId}] Poll failed:`, error);
              }
            }
          })();
        }, 3000);

        // Store interval for cleanup
        this.sdActivityPollIntervals.set(sdId, pollInterval);
      },
    };
  }

  /**
   * Clean up watchers for a specific SD
   */
  async cleanupWatchers(sdId: string): Promise<void> {
    console.log(`[Cleanup] Cleaning up watchers for SD: ${sdId}`);

    // Stop and remove file watcher
    const fileWatcher = this.sdFileWatchers.get(sdId);
    if (fileWatcher) {
      await fileWatcher.unwatch();
      this.sdFileWatchers.delete(sdId);
    }

    // Stop and remove activity watcher
    const activityWatcher = this.sdActivityWatchers.get(sdId);
    if (activityWatcher) {
      await activityWatcher.unwatch();
      this.sdActivityWatchers.delete(sdId);
    }

    // Stop and remove activity poll interval
    const activityPollInterval = this.sdActivityPollIntervals.get(sdId);
    if (activityPollInterval) {
      clearInterval(activityPollInterval);
      this.sdActivityPollIntervals.delete(sdId);
    }

    // Remove activity sync
    this.sdActivitySyncs.delete(sdId);

    // Remove activity logger
    this.sdActivityLoggers.delete(sdId);

    // Stop and remove deletion watcher
    const deletionWatcher = this.sdDeletionWatchers.get(sdId);
    if (deletionWatcher) {
      await deletionWatcher.unwatch();
      this.sdDeletionWatchers.delete(sdId);
    }

    // Stop and remove deletion poll interval
    const deletionPollInterval = this.sdDeletionPollIntervals.get(sdId);
    if (deletionPollInterval) {
      clearInterval(deletionPollInterval);
      this.sdDeletionPollIntervals.delete(sdId);
    }

    // Remove deletion sync
    this.sdDeletionSyncs.delete(sdId);

    // Remove deletion logger
    this.sdDeletionLoggers.delete(sdId);

    // Stop and remove media watcher
    const mediaWatcher = this.sdMediaWatchers.get(sdId);
    if (mediaWatcher) {
      await mediaWatcher.unwatch();
      this.sdMediaWatchers.delete(sdId);
    }

    console.log(`[Cleanup] Watchers cleaned up for SD: ${sdId}`);
  }

  /**
   * Wait for all pending syncs to complete with timeout
   */
  async waitForPendingSyncs(timeoutMs = 5000): Promise<void> {
    console.log('[App] Waiting for pending activity syncs...');
    const syncPromises: Promise<void>[] = [];
    for (const activitySync of this.sdActivitySyncs.values()) {
      syncPromises.push(activitySync.waitForPendingSyncs());
    }
    if (syncPromises.length > 0) {
      try {
        await Promise.race([
          Promise.all(syncPromises),
          new Promise<void>((_, reject) => {
            setTimeout(() => {
              reject(new Error('Sync timeout'));
            }, timeoutMs);
          }),
        ]);
        console.log('[App] All pending syncs completed');
      } catch {
        console.warn('[App] Pending syncs timed out after', timeoutMs, 'ms, continuing shutdown');
      }
    }
  }

  /**
   * Clean up all watchers
   */
  async cleanupAllWatchers(): Promise<void> {
    console.log('[Cleanup] Cleaning up all SD watchers');

    const sdIds = [
      ...new Set([
        ...this.sdFileWatchers.keys(),
        ...this.sdActivityWatchers.keys(),
        ...this.sdDeletionWatchers.keys(),
        ...this.sdMediaWatchers.keys(),
      ]),
    ];

    for (const sdId of sdIds) {
      await this.cleanupWatchers(sdId);
    }

    console.log('[Cleanup] All SD watchers cleaned up');
  }
}
