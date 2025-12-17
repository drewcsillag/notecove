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
import type { Database } from '@notecove/shared';
import {
  ActivityLogger,
  ActivitySync,
  DeletionLogger,
  DeletionSync,
  ImageStorage,
  isValidImageId,
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

  constructor(profilePresenceReader: ProfilePresenceReader | null = null) {
    this.profilePresenceReader = profilePresenceReader;
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
    activityLogger.setInstanceId(instanceId);
    await activityLogger.initialize();

    // Register the activity logger with CRDT Manager
    // Type assertion needed due to TypeScript module resolution quirk between dist and src
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    crdtManager.setActivityLogger(sdId, activityLogger as any);

    // Store logger for periodic compaction
    this.sdActivityLoggers.set(sdId, activityLogger);

    // Create and initialize DeletionLogger for this SD
    const deletionLogger = new DeletionLogger(fsAdapter, deletionDir);
    deletionLogger.setInstanceId(instanceId);
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

    // Load previously skipped stale entries from persistence
    await activitySync.loadSkippedEntries();

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

      // Ignore directory creation events and our own log file
      if (event.filename === '.activity' || event.filename === `${instanceId}.log`) {
        console.log(
          `[ActivityWatcher ${sdId}] Ignoring own log file or directory:`,
          event.filename
        );
        // Broadcast for test debugging
        for (const window of BrowserWindow.getAllWindows()) {
          window.webContents.send('test:activity-watcher-debug', {
            sdId,
            filename: event.filename,
            reason: 'own-log',
            instanceId,
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
            .catch((err) => {
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
