/**
 * Electron Main Process
 */

import { app, BrowserWindow, ipcMain, powerMonitor } from 'electron';
import { join } from 'path';
import { BetterSqliteAdapter, SqliteDatabase } from './database';
import type { Database } from '@notecove/shared';
import {
  AppendLogManager,
  SyncDirectoryStructure,
  extractTitleFromDoc,
  extractTags,
  SDMarker,
  type SDType,
  ProfileLock,
  AppStateKey,
} from '@notecove/shared';
import { IPCHandlers } from './ipc/handlers';
import type { SyncStatus, StaleSyncEntry } from './ipc/types';
import { CRDTManagerImpl, type CRDTManager } from './crdt';
import { NodeFileSystemAdapter } from './storage/node-fs-adapter';
import * as fs from 'fs/promises';
import { randomUUID } from 'crypto';
import * as Y from 'yjs';
import { ConfigManager } from './config/manager';
import { initializeTelemetry } from './telemetry/config';
import { NoteMoveManager } from './note-move-manager';
import { DiagnosticsManager } from './diagnostics-manager';
import { BackupManager } from './backup-manager';
import { getProfileStorage } from './profile-picker';
import { parseCliArgs } from './cli/cli-parser';
import { WebServerManager } from './web-server/manager';
import { selectProfile } from './app-profile';
import { initializeDefaultSD, loadAndRegisterSDs } from './app-storage-dirs';
import { registerBasicIPCHandlers } from './app-ipc-setup';
import { ProfilePresenceManager } from './profile-presence-manager';
import { ProfilePresenceReader } from './profile-presence-reader';
import { WindowStateManager } from './window-state-manager';
import * as os from 'os';
import { createMenu as createMenuImpl, type MenuDependencies } from './menu';
import { SDWatcherManager } from './sd-watcher-manager';
import {
  createWindow as createWindowImpl,
  restoreWindows as restoreWindowsImpl,
  type CreateWindowOptions,
} from './window-manager';
import { ensureDefaultNote } from './note-init';
import { discoverNewNotes } from './note-discovery';

let mainWindow: BrowserWindow | null = null;
let webServerManager: WebServerManager | null = null;
let database: Database | null = null;
let configManager: ConfigManager | null = null;
let selectedProfileId: string | null = null;
let selectedProfileName: string | null = null;
let ipcHandlers: IPCHandlers | null = null;
let compactionInterval: NodeJS.Timeout | null = null;
let storageManager: AppendLogManager | null = null;
let crdtManager: CRDTManager | null = null;
let noteMoveManager: NoteMoveManager | null = null;
let diagnosticsManager: DiagnosticsManager | null = null;
let backupManager: BackupManager | null = null;
let sdMarker: SDMarker | null = null;
let profileLock: ProfileLock | null = null;
let profilePresenceManager: ProfilePresenceManager | null = null;
let profilePresenceReader: ProfilePresenceReader | null = null;
let windowStateManager: WindowStateManager | null = null;
let syncStatusWindow: BrowserWindow | null = null;
const allWindows: BrowserWindow[] = [];
let freshStartRequested = false;

// SD Watcher Manager: manages all watchers and sync state for Storage Directories
let sdWatcherManager: SDWatcherManager | null = null;

/**
 * Wrapper for createWindow that manages global state
 */
function createWindow(options?: CreateWindowOptions): BrowserWindow {
  const result = createWindowImpl(options, {
    isPackaged: app.isPackaged,
    selectedProfileName,
    windowStateManager,
    syncStatusWindow,
    mainWindow,
    allWindows,
  });

  // Track window
  allWindows.push(result.window);

  // Update global references
  if (result.shouldSetAsMain) {
    mainWindow = result.window;
    // Refresh menu so handlers have the updated mainWindow reference
    createMenu();
  }
  if (result.shouldSetAsSyncStatus) {
    syncStatusWindow = result.window;
  }

  // Handle cleanup on close
  result.window.on('closed', () => {
    if (mainWindow === result.window) {
      mainWindow = null;
    }
    if (syncStatusWindow === result.window) {
      syncStatusWindow = null;
    }
  });

  return result.window;
}

/**
 * Wrapper for restoreWindows that uses global state
 */
async function restoreWindows(): Promise<boolean> {
  return restoreWindowsImpl(windowStateManager, database, createWindow);
}

/**
 * Initialize database
 *
 * @param profileId - Optional profile ID for profile-specific database path
 */
async function initializeDatabase(profileId?: string): Promise<Database> {
  // Initialize config manager if not already done
  if (!configManager) {
    const configPath = process.env['TEST_CONFIG_PATH'] ?? undefined;
    configManager = new ConfigManager(configPath);
  }

  // Determine database path:
  // 1. Use TEST_DB_PATH if in test mode
  // 2. If profileId provided, use profile-specific database path
  // 3. Otherwise use custom path from config if set
  // 4. Fall back to default userData/notecove.db
  let dbPath: string;
  if (process.env['TEST_DB_PATH']) {
    dbPath = process.env['TEST_DB_PATH'];
  } else if (profileId) {
    // Use profile-specific database path
    const appDataDir = app.getPath('userData');
    const profileStorage = getProfileStorage(appDataDir);
    dbPath = profileStorage.getProfileDatabasePath(profileId);
    // Ensure profile directory exists
    await profileStorage.ensureProfileDataDir(profileId);
    console.log(`[Profile] Using profile database: ${dbPath}`);
  } else {
    dbPath = await configManager.getDatabasePath();
  }

  if (process.env['NODE_ENV'] === 'test') {
    console.log(`[TEST MODE] Initializing database at: ${dbPath}`);
  }

  const adapter = new BetterSqliteAdapter(dbPath);
  const db = new SqliteDatabase(adapter);
  await db.initialize();

  if (process.env['NODE_ENV'] === 'test') {
    console.log('[TEST MODE] Database initialized successfully');
  }

  return db;
}

// App lifecycle
// Create application menu

/**
 * Wrapper function to create menu with current global state
 */
function createMenu(): void {
  const deps: MenuDependencies = {
    mainWindow,
    syncStatusWindow,
    allWindows,
    ipcHandlers,
    database,
    webServerManager,
    windowStateManager,
    selectedProfileId,
    createWindow,
  };
  createMenuImpl(deps);
}

void app.whenReady().then(async () => {
  try {
    // Parse CLI arguments
    const cliArgs = parseCliArgs(process.argv);

    // Check for --fresh flag (skip window state restoration)
    if (cliArgs.freshStart) {
      freshStartRequested = true;
      console.log('[WindowState] Fresh start requested via --fresh flag');
    }

    // Check for --debug-profiles flag
    if (cliArgs.debugProfiles) {
      const appDataDir = app.getPath('userData');
      const profileStorage = getProfileStorage(appDataDir);
      const config = await profileStorage.loadProfiles();
      console.log('[Profile Debug] profiles.json contents:');
      console.log(JSON.stringify(config, null, 2));
    }

    // Initialize telemetry (local mode always on, remote opt-in)
    await initializeTelemetry({
      remoteMetricsEnabled: false, // Will be controlled via settings panel
      devMode: process.env['NODE_ENV'] !== 'production',
    });
    console.log('[Telemetry] OpenTelemetry initialized');

    // Debug logging for environment (test mode only)
    if (process.env['NODE_ENV'] === 'test') {
      console.log('[TEST MODE] App ready, starting initialization...');
      try {
        await fs.appendFile(
          '/var/tmp/electron-env.log',
          `\n=== New Launch ===\nNODE_ENV: ${process.env['NODE_ENV']}\nTEST_DB_PATH: ${process.env['TEST_DB_PATH']}\n`
        );
      } catch (e) {
        console.error('Failed to write env log:', e);
      }
    }

    // Profile selection - skip if in test mode
    // Test mode is indicated by TEST_STORAGE_DIR, TEST_DB_PATH, or NODE_ENV=test
    const isTestMode =
      !!process.env['TEST_STORAGE_DIR'] ||
      !!process.env['TEST_DB_PATH'] ||
      process.env['NODE_ENV'] === 'test';

    const profileResult = await selectProfile(cliArgs, isTestMode);
    if (profileResult) {
      selectedProfileId = profileResult.profileId;
      selectedProfileName = profileResult.profileName;
      profileLock = profileResult.profileLock;
    }

    // Initialize database (with profile ID if selected)
    database = await initializeDatabase(selectedProfileId ?? undefined);

    // Initialize window state manager for session restoration
    windowStateManager = new WindowStateManager(database);
    console.log('[WindowState] Manager initialized');

    // Clean up orphaned data from deleted SDs

    const cleanupPromise = database.cleanupOrphanedData();

    cleanupPromise
      .then(() => {
        console.log('[Database] Orphaned data cleanup completed');
      })
      .catch((error: unknown) => {
        console.error('[Database] Failed to cleanup orphaned data:', error);
      });

    if (process.env['NODE_ENV'] === 'test') {
      console.log('[TEST MODE] Database ready, initializing CRDT manager...');
    }

    // Initialize file system adapter
    const fsAdapter = new NodeFileSystemAdapter();

    // Initialize SD marker for dev/prod safety checks
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    sdMarker = new SDMarker(fsAdapter as any);
    const isDevBuild = !app.isPackaged;
    const currentSDType: SDType = isDevBuild ? 'dev' : 'prod';

    // Determine storage directory (shared across instances for sync)
    const storageDir = process.env['TEST_STORAGE_DIR'] ?? join(app.getPath('userData'), 'storage');

    // Initialize default SD structure
    await initializeDefaultSD(
      storageDir,
      fsAdapter,
      sdMarker,
      currentSDType,
      !!process.env['TEST_STORAGE_DIR']
    );

    // Initialize AppendLogManager with database (multi-SD aware)
    // InstanceId is unique per app installation (NOT per profile)
    // It's persisted in the database to remain stable across restarts
    let instanceId: string = process.env['INSTANCE_ID'] ?? '';
    if (!instanceId) {
      const storedInstanceId = await database.getState(AppStateKey.InstanceId);
      if (storedInstanceId) {
        instanceId = storedInstanceId;
        console.log(`[InstanceId] Loaded existing instanceId: ${instanceId}`);
      } else {
        instanceId = randomUUID();
        await database.setState(AppStateKey.InstanceId, instanceId);
        console.log(`[InstanceId] Generated new instanceId: ${instanceId}`);
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    storageManager = new AppendLogManager(fsAdapter as any, database, instanceId);

    // Register the default SD
    storageManager.registerSD('default', storageDir);

    // Load all Storage Directories from database and register them
    // Also perform safety checks for dev/prod mismatches
    const allSDs = await database.getAllStorageDirs();
    await loadAndRegisterSDs(
      database,
      storageManager,
      sdMarker,
      currentSDType,
      isDevBuild,
      !!process.env['TEST_STORAGE_DIR']
    );

    // Initialize CRDT manager with database reference
    // Type assertion needed due to TypeScript module resolution quirk between dist and src
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    crdtManager = new CRDTManagerImpl(storageManager as any, database);

    // Eagerly load folder tree to trigger demo folder creation
    // This ensures demo folders are created while we know the updates directory exists
    await crdtManager.loadFolderTree('default');

    // Initialize ProfilePresenceManager for writing presence files to SDs
    // This enables the Stale Sync UI to show meaningful device/user names
    const platform = process.platform as 'darwin' | 'win32' | 'linux';
    profilePresenceManager = new ProfilePresenceManager(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      fsAdapter as any,
      database,
      {
        profileId: selectedProfileId ?? instanceId,
        instanceId: instanceId,
        profileName: selectedProfileName ?? 'Default',
        hostname: os.hostname(),
        platform,
        appVersion: app.getVersion(),
      }
    );

    // Initialize ProfilePresenceReader for reading and caching presence files from SDs
    // This populates the cache that getStaleSyncs uses to show meaningful device names
    profilePresenceReader = new ProfilePresenceReader(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      fsAdapter as any,
      database
    );

    // Initialize SD Watcher Manager
    sdWatcherManager = new SDWatcherManager(profilePresenceReader);

    // Handler for when new SD is created (for IPC)
    const handleNewStorageDir = async (sdId: string, sdPath: string): Promise<void> => {
      if (!database) {
        console.error('[Init] Database not initialized');
        throw new Error('Database not initialized');
      }

      if (!storageManager) {
        console.error('[Init] StorageManager not initialized');
        throw new Error('StorageManager not initialized');
      }

      if (!crdtManager) {
        console.error('[Init] CRDTManager not initialized');
        throw new Error('CRDTManager not initialized');
      }

      // Helper to broadcast progress to all windows
      const sendProgress = (step: number, total: number, message: string) => {
        BrowserWindow.getAllWindows().forEach((window) => {
          window.webContents.send('sd:init-progress', { sdId, step, total, message });
        });
      };

      try {
        console.log(`[Init] ===== Initializing new SD: ${sdId} at ${sdPath} =====`);

        // 1. Create SD config and initialize structure
        sendProgress(1, 6, 'Creating storage directory structure...');
        console.log(`[Init] Step 1: Creating SD structure`);
        const sdConfig = { id: sdId, path: sdPath, label: '' };
        const newSdStructure = new SyncDirectoryStructure(fsAdapter, sdConfig);
        await newSdStructure.initialize();
        console.log(`[Init] Step 1: SD structure created successfully`);

        // Write SD marker file for dev/prod safety (skip in test mode)
        if (!process.env['TEST_STORAGE_DIR'] && sdMarker) {
          await sdMarker.writeSDMarker(sdPath, currentSDType);
          console.log(`[Init] Step 1.5: SD marker written (${currentSDType})`);
        }

        // 2. Ensure activity directory exists (required for watchers)
        sendProgress(2, 6, 'Setting up activity tracking...');
        const activityDir = join(sdPath, 'activity');
        console.log(`[Init] Step 2: Creating activity directory at ${activityDir}`);
        await fsAdapter.mkdir(activityDir);
        console.log(`[Init] Step 2: Activity directory created successfully`);

        // 3. Register with StorageManager
        sendProgress(3, 6, 'Registering storage directory...');
        console.log(`[Init] Step 3: Registering with StorageManager`);
        storageManager.registerSD(sdId, sdPath);
        console.log(`[Init] Step 3: Registered with StorageManager`);

        // 4. Load folder tree for this SD
        sendProgress(4, 6, 'Loading folder structure...');
        console.log(`[Init] Step 4: Loading folder tree`);
        await crdtManager.loadFolderTree(sdId);
        console.log(`[Init] Step 4: Folder tree loaded`);

        // 5. Set up watchers for this SD
        sendProgress(5, 6, 'Setting up file watchers...');
        console.log(`[Init] Step 5: Setting up watchers`);
        if (!sdWatcherManager) {
          throw new Error('SD Watcher Manager not initialized');
        }
        const sdWatcherResult = await sdWatcherManager.setupSDWatchers(
          sdId,
          sdPath,
          fsAdapter,
          instanceId,
          storageManager,
          crdtManager,
          database
        );
        // For runtime SD addition, run initial sync immediately (blocking)
        // since the user is actively waiting for the SD to be ready
        await sdWatcherResult.runInitialSync();
        console.log(`[Init] Step 5: Watchers set up and initial sync complete`);

        // 5.5 Write profile presence to the new SD
        if (profilePresenceManager) {
          await profilePresenceManager.writePresence(sdPath);
          console.log(`[Init] Step 5.5: Profile presence written`);
        }

        // 6. Scan for existing notes on disk and load them into database
        console.log(`[Init] Step 6: Scanning for existing notes`);
        try {
          const notesDir = join(sdPath, 'notes');
          const noteDirectories = await fsAdapter.listFiles(notesDir);
          let loadedCount = 0;

          // Filter to count only valid note IDs (same logic as loading loop)
          const isValidNoteId = (id: string): boolean => {
            return (
              !id.startsWith('.') &&
              id.length > 0 &&
              id !== 'undefined' &&
              id !== 'Icon' &&
              !id.includes('\r') &&
              id !== 'desktop.ini' &&
              id !== 'Thumbs.db' &&
              !/\s\(\d+\)$/.test(id) &&
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
            );
          };

          const totalNotes = noteDirectories.filter(isValidNoteId).length;

          sendProgress(6, 6, `Loading ${totalNotes} notes and indexing tags...`);

          for (const noteId of noteDirectories) {
            // Skip invalid note IDs and system files
            if (!isValidNoteId(noteId)) {
              console.log(`[Init] Skipping invalid/system file: ${noteId}`);
              continue;
            }

            // Check if note is already in database
            const existingNote = await database.getNote(noteId);
            if (existingNote) continue;

            try {
              // Load note from disk
              await crdtManager.loadNote(noteId, sdId);

              // Extract metadata and insert into database
              const noteDoc = crdtManager.getNoteDoc(noteId);
              const doc = crdtManager.getDocument(noteId);
              if (doc) {
                const crdtMetadata = noteDoc?.getMetadata();
                const folderId = crdtMetadata?.folderId ?? null;
                // Extract title and strip any HTML/XML tags that might be present
                let title = extractTitleFromDoc(doc, 'content');
                // Strip HTML/XML tags from title
                title = title.replace(/<[^>]+>/g, '').trim() || 'Untitled';

                // Extract text content for tag indexing and caching
                const content = doc.getXmlFragment('content');
                let contentText = '';
                content.forEach((item) => {
                  if (item instanceof Y.XmlText) {
                    const textStr = String(item.toString());
                    contentText += textStr + '\n';
                  } else if (item instanceof Y.XmlElement) {
                    const extractText = (el: Y.XmlElement | Y.XmlText): string => {
                      if (el instanceof Y.XmlText) {
                        return String(el.toString());
                      }
                      let text = '';
                      el.forEach((child: unknown) => {
                        const childElement = child as Y.XmlElement | Y.XmlText;
                        text += extractText(childElement);
                      });
                      return text;
                    };
                    contentText += extractText(item) + '\n';
                  }
                });

                // Generate content preview (first 200 chars after title)
                const lines = contentText.split('\n');
                const contentAfterTitle = lines.slice(1).join('\n').trim();
                const contentPreview = contentAfterTitle.substring(0, 200);

                await database.upsertNote({
                  id: noteId,
                  title,
                  sdId,
                  folderId,
                  created: crdtMetadata?.created ?? Date.now(),
                  modified: crdtMetadata?.modified ?? Date.now(),
                  deleted: crdtMetadata?.deleted ?? false,
                  pinned: crdtMetadata?.pinned ?? false,
                  contentPreview,
                  contentText,
                });

                // Extract and index tags
                const tags = extractTags(contentText);
                for (const tagName of tags) {
                  const tag =
                    (await database.getTagByName(tagName)) ?? (await database.createTag(tagName));
                  await database.addTagToNote(noteId, tag.id);
                }

                loadedCount++;
              }
            } catch (error) {
              console.error(`[Init] Failed to load note ${noteId}:`, error);
            }
          }

          console.log(`[Init] Step 6: Loaded ${loadedCount} existing notes from disk`);
        } catch (error) {
          console.error(`[Init] Failed to scan for existing notes:`, error);
        }

        // Send completion
        BrowserWindow.getAllWindows().forEach((window) => {
          window.webContents.send('sd:init-complete', { sdId });
        });

        console.log(`[Init] ===== Successfully initialized new SD: ${sdId} =====`);
      } catch (error) {
        console.error(`[Init] ERROR initializing new SD ${sdId}:`, error);

        // Send error
        BrowserWindow.getAllWindows().forEach((window) => {
          window.webContents.send('sd:init-error', {
            sdId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        });

        throw error;
      }
    };

    // Initialize NoteMoveManager for atomic cross-SD moves
    noteMoveManager = new NoteMoveManager(database, instanceId);
    console.log('[Init] NoteMoveManager initialized');

    // Initialize DiagnosticsManager for advanced recovery diagnostics
    diagnosticsManager = new DiagnosticsManager(database);
    console.log('[Init] DiagnosticsManager initialized');

    // Initialize BackupManager for backup and restore operations
    const userDataPath = app.getPath('userData');
    backupManager = new BackupManager(database, userDataPath, undefined, handleNewStorageDir);
    console.log('[Init] BackupManager initialized');

    // Initialize IPC handlers (pass createWindow for testing support and SD callback)
    if (!configManager) {
      throw new Error('ConfigManager not initialized');
    }
    ipcHandlers = new IPCHandlers(
      crdtManager,
      database,
      configManager,
      storageManager,
      noteMoveManager,
      diagnosticsManager,
      backupManager,
      selectedProfileId ?? instanceId, // profileId for @-mentions
      createWindow,
      handleNewStorageDir,
      (sdId: string) => sdWatcherManager?.getDeletionLogger(sdId),
      // getSyncStatus callback - returns sync status for UI indicator
      (): SyncStatus => {
        const perSd: SyncStatus['perSd'] = [];
        let totalPending = 0;

        /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/restrict-plus-operands */
        for (const [sdId, activitySync] of (
          sdWatcherManager?.getActivitySyncs() ?? new Map()
        ).entries()) {
          const count = activitySync.getPendingSyncCount();
          const noteIds = activitySync.getPendingNoteIds();
          totalPending += count;
          // We don't have easy access to SD names here, so use sdId for now
          // The UI can look up the name if needed
          perSd.push({
            sdId,
            sdName: sdId, // Will be resolved in UI
            pendingCount: count,
            pendingNoteIds: noteIds,
          });
        }
        /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/restrict-plus-operands */

        return {
          pendingCount: totalPending,
          perSd,
          isSyncing: totalPending > 0,
        };
      },
      // getStaleSyncs callback - returns stale sync entries for UI display
      async (): Promise<StaleSyncEntry[]> => {
        const result: StaleSyncEntry[] = [];

        // Database may not be initialized yet
        if (!database) {
          return result;
        }

        /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
        for (const [sdId, activitySync] of (
          sdWatcherManager?.getActivitySyncs() ?? new Map()
        ).entries()) {
          const staleEntries = activitySync.getStaleEntries();

          // Get SD name for display
          const sd = await database.getStorageDir(sdId);
          const sdName = sd?.name ?? sdId;

          for (const entry of staleEntries) {
            // Look up note title from database
            const noteCache = await database.getNote(entry.noteId);

            // Look up source profile from presence cache
            // First try by instanceId (new method), then fall back to profileId (for backwards compatibility)
            let profilePresence = await database.getProfilePresenceCacheByInstanceId(
              entry.sourceInstanceId,
              sdId
            );
            // Fall back to lookup by profileId for older presence files without instanceId
            // (In current design, instanceId === profileId for most cases)
            profilePresence ??= await database.getProfilePresenceCache(
              entry.sourceInstanceId,
              sdId
            );

            const sourceProfile = profilePresence
              ? {
                  profileId: profilePresence.profileId,
                  profileName: profilePresence.profileName ?? 'Unknown',
                  hostname: profilePresence.hostname ?? 'Unknown Device',
                  lastSeen: profilePresence.lastUpdated ?? profilePresence.cachedAt,
                }
              : undefined;

            // Build the entry, only including optional fields if they have values
            const staleSyncEntry: StaleSyncEntry = {
              sdId,
              sdName,
              noteId: entry.noteId,
              sourceInstanceId: entry.sourceInstanceId,
              expectedSequence: entry.expectedSequence,
              highestSequenceForNote: entry.highestSequenceForNote,
              gap: entry.gap,
              detectedAt: entry.detectedAt,
            };
            /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */

            // Add optional fields only if they have values
            if (noteCache?.title) {
              staleSyncEntry.noteTitle = noteCache.title;
            }
            if (sourceProfile) {
              staleSyncEntry.sourceProfile = sourceProfile;
            }

            result.push(staleSyncEntry);
          }
        }

        return result;
      },
      // skipStaleEntry callback - skip a stale entry (accept data loss)
      (
        sdId: string,
        noteId: string,
        sourceInstanceId: string
      ): Promise<{ success: boolean; error?: string }> => {
        const activitySync = sdWatcherManager?.getActivitySyncs().get(sdId);
        if (!activitySync) {
          return Promise.resolve({
            success: false,
            error: `Storage directory ${sdId} not found`,
          });
        }

        try {
          void activitySync.removeStaleEntry(noteId, sourceInstanceId);
          // TODO: Update watermark to skip past missing sequences
          console.log(
            `[Stale Sync] Skipped stale entry: sdId=${sdId}, noteId=${noteId}, sourceInstanceId=${sourceInstanceId}`
          );
          return Promise.resolve({ success: true });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return Promise.resolve({ success: false, error: errorMessage });
        }
      },
      // retryStaleEntry callback - retry syncing a stale entry
      async (
        sdId: string,
        noteId: string,
        sourceInstanceId: string
      ): Promise<{ success: boolean; error?: string }> => {
        const activitySync = sdWatcherManager?.getActivitySyncs().get(sdId);
        if (!activitySync) {
          return { success: false, error: `Storage directory ${sdId} not found` };
        }

        try {
          // Remove from stale entries so it can be retried
          void activitySync.removeStaleEntry(noteId, sourceInstanceId);
          // Force a sync cycle
          await activitySync.syncFromOtherInstances();
          console.log(
            `[Stale Sync] Retried stale entry: sdId=${sdId}, noteId=${noteId}, sourceInstanceId=${sourceInstanceId}`
          );
          return { success: true };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return { success: false, error: errorMessage };
        }
      },
      // onUserSettingsChanged callback - update profile presence when user settings change
      async (key: string, _value: string): Promise<void> => {
        if (profilePresenceManager && database) {
          console.log(`[User Settings] ${key} changed, updating profile presence`);
          // Get all connected SD paths
          const allSDs = await database.getAllStorageDirs();
          const allSDPaths = [
            storageDir,
            ...allSDs
              .filter((sd: { id: string; path: string }) => sd.id !== 'default')
              .map((sd: { id: string; path: string }) => sd.path),
          ];
          await profilePresenceManager.writePresenceToAllSDs(allSDPaths);
        }
      }
    );

    // Set up broadcast callback for CRDT manager to send updates to renderer

    crdtManager.setBroadcastCallback((noteId: string, update: Uint8Array) => {
      ipcHandlers?.broadcastToAll('note:updated', noteId, update);
    });
    if (process.env['NODE_ENV'] === 'test') {
      await fs.appendFile(
        '/var/tmp/auto-cleanup.log',
        `${new Date().toISOString()} [Init] IPC handlers created\n`
      );
    }

    // Initialize WebServerManager
    webServerManager = new WebServerManager({
      database,
      crdtManager,
      ipcHandlers,
      configManager,
    });
    await webServerManager.initialize();
    console.log('[Init] WebServerManager initialized');

    // Create default note if none exists
    // IMPORTANT: Do this BEFORE setupSDWatchers to prevent race condition where
    // activity sync imports empty note files before welcome note is created
    await ensureDefaultNote(
      database,
      crdtManager,
      storageDir,
      instanceId,
      (name: 'documents' | 'userData') => app.getPath(name)
    );

    // Collect initial sync functions to run in background after window creation
    const initialSyncFunctions: (() => Promise<void>)[] = [];

    // Set up watchers for default SD AFTER ensureDefaultNote
    // This ensures the welcome note is created before activity sync runs
    /* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */
    if (!sdWatcherManager) {
      throw new Error('SD Watcher Manager not initialized');
    }
    const defaultSDResult = await sdWatcherManager.setupSDWatchers(
      'default',
      storageDir,
      fsAdapter,
      instanceId,
      storageManager,
      crdtManager,
      database
    );
    initialSyncFunctions.push(defaultSDResult.runInitialSync);

    if (process.env['NODE_ENV'] === 'test') {
      await fs.appendFile(
        '/var/tmp/auto-cleanup.log',
        `${new Date().toISOString()} [Init] Default note ensured\n`
      );
    }

    // Set up watchers for all other registered SDs (only if fully initialized)
    // Don't run initial sync yet - will run in background after window creation
    for (const sd of allSDs) {
      if (sd.id !== 'default') {
        // Check if SD has basic structure (notes directory)
        const notesPath = join(sd.path, 'notes');
        const isInitialized = await fsAdapter.exists(notesPath);

        if (isInitialized) {
          // Ensure folders/logs exists (create if missing)
          const folderLogsPath = join(sd.path, 'folders', 'logs');
          if (!(await fsAdapter.exists(folderLogsPath))) {
            console.log(`[Init] Creating folders/logs for SD: ${sd.id}`);
            await fsAdapter.mkdir(folderLogsPath);
          }

          console.log(`[Init] Setting up watchers for SD: ${sd.id}`);
          const sdResult = await sdWatcherManager.setupSDWatchers(
            sd.id,
            sd.path,
            fsAdapter,
            instanceId,
            storageManager,
            crdtManager,
            database
          );
          initialSyncFunctions.push(sdResult.runInitialSync);
        } else {
          console.log(
            `[Init] Skipping watchers for SD: ${sd.id} (not fully initialized: ${sd.path})`
          );
        }
      }
    }

    // Write profile presence to all SDs on startup
    // This enables other devices to see who is using each SD
    const allSDPaths = [
      storageDir,
      ...allSDs.filter((sd) => sd.id !== 'default').map((sd) => sd.path),
    ];
    await profilePresenceManager.writePresenceToAllSDs(allSDPaths);

    // Periodic compaction of activity logs for all SDs (every 5 minutes)
    compactionInterval = setInterval(
      () => {
        /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
        for (const [sdId, logger] of sdWatcherManager?.getActivityLoggers() ?? new Map()) {
          logger.compact().catch((err: unknown) => {
            console.error(`[ActivityLogger] Failed to compact log for SD ${sdId}:`, err);
            /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
          });
        }
      },
      5 * 60 * 1000
    );

    if (process.env['NODE_ENV'] === 'test') {
      console.log('[TEST MODE] IPC handlers ready, creating window...');
    }

    // Register basic IPC handlers
    registerBasicIPCHandlers({
      selectedProfileId,
      isPackaged: app.isPackaged,
      appVersion: app.getVersion(),
      appDataDir: app.getPath('userData'),
      webServerManager,
      createMenu,
    });

    // Register IPC handler for opening sync status window
    ipcMain.handle('sync:openWindow', () => {
      createWindow({ syncStatus: true });
    });

    // Register window state IPC handlers (for session restoration)
    ipcMain.handle(
      'windowState:reportCurrentNote',
      (_event, windowId: string, noteId: string, sdId?: string) => {
        if (windowStateManager) {
          windowStateManager.updateNoteId(windowId, noteId, sdId);
        }
      }
    );

    ipcMain.handle(
      'windowState:reportEditorState',
      (_event, windowId: string, editorState: { scrollTop: number; cursorPosition: number }) => {
        if (windowStateManager) {
          windowStateManager.updateEditorState(windowId, editorState);
        }
      }
    );

    ipcMain.handle('windowState:getSavedState', async (_event, windowId: string) => {
      // Get saved state for a specific window from the last session
      // This is used when a restored window wants to know its previous state
      if (!windowStateManager) {
        return null;
      }
      const states = await windowStateManager.loadState();
      const state = states.find((s) => s.id === windowId);
      if (!state) {
        return null;
      }
      return {
        noteId: state.noteId,
        sdId: state.sdId,
        editorState: state.editorState,
      };
    });

    // Debug: Trigger note discovery manually (for testing the wake-from-sleep bug fix)
    ipcMain.handle('debug:triggerNoteDiscovery', async () => {
      console.log('[Debug] Manually triggering note discovery...');
      const results: { sdId: string; discovered: string[] }[] = [];

      if (!database) {
        console.error('[Debug] Database not initialized');
        return results;
      }

      try {
        const storageDirs = await database.getAllStorageDirs();

        for (const sd of storageDirs) {
          console.log(`[Debug] Discovering notes for SD ${sd.id}...`);
          if (crdtManager) {
            const discovered = await discoverNewNotes(sd.id, sd.path, database, crdtManager);
            results.push({
              sdId: sd.id,
              discovered: Array.from(discovered),
            });
          }
        }
      } catch (error: unknown) {
        console.error('[Debug] Note discovery failed:', error);
      }

      console.log('[Debug] Note discovery complete:', results);
      return results;
    });

    // Create menu
    createMenu();

    // Restore windows or create default - before running initial syncs
    // This ensures the app appears quickly regardless of sync status
    let windowsRestored = false;
    if (freshStartRequested) {
      console.log('[WindowState] Skipping restoration due to fresh start');
    } else {
      windowsRestored = await restoreWindows();
    }
    if (!windowsRestored) {
      // No saved state or fresh start, create default window
      createWindow();
    }

    // Run initial syncs in background (non-blocking)
    // This allows the window to appear immediately while sync happens in background
    console.log(`[Init] Starting background sync for ${initialSyncFunctions.length} SD(s)...`);
    void Promise.all(initialSyncFunctions.map((fn) => fn())).then(async () => {
      console.log('[Init] All initial syncs complete');

      // Run cleanup and recovery AFTER syncs complete
      // These operations may depend on sync state being up-to-date
      console.log('[Init] Running auto-cleanup for old deleted notes...');
      if (process.env['NODE_ENV'] === 'test') {
        await fs.appendFile(
          '/var/tmp/auto-cleanup.log',
          `${new Date().toISOString()} [Init] About to run auto-cleanup\n`
        );
      }
      await ipcHandlers?.runAutoCleanup(30);
      if (process.env['NODE_ENV'] === 'test') {
        await fs.appendFile(
          '/var/tmp/auto-cleanup.log',
          `${new Date().toISOString()} [Init] Auto-cleanup completed\n`
        );
      }

      // Run image orphan cleanup (mark-and-sweep with 14-day grace period)
      console.log('[Init] Running image orphan cleanup...');
      await ipcHandlers?.runImageCleanup(14);

      // Recover incomplete cross-SD note moves
      console.log('[Init] Checking for incomplete note moves...');
      await noteMoveManager?.recoverIncompleteMoves();
      await noteMoveManager?.cleanupOldMoves();
      console.log('[Init] Note move recovery completed');

      // Broadcast that all initial syncs are complete
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send('sync:all-initial-syncs-complete');
      }
    });

    if (process.env['NODE_ENV'] === 'test') {
      console.log('[TEST MODE] Window created successfully');
    }

    app.on('activate', () => {
      // On macOS re-create window when dock icon is clicked
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    console.error('Failed to initialize app:', error);
    app.quit();
  }
});

void app.on('window-all-closed', () => {
  // On macOS, keep app running unless explicitly quit
  // The isExplicitQuit flag ensures quit continues after before-quit
  // saves window state and calls app.quit() again
  if (process.platform !== 'darwin' || isExplicitQuit) {
    app.quit();
  }
});

// Handle system resume from sleep/suspend
// This triggers a sync from other instances to catch up on changes made while sleeping
powerMonitor.on('resume', () => {
  console.log('[PowerMonitor] System resumed from sleep, triggering activity and deletion sync...');

  // Sync all storage directories - activity sync
  /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
  for (const [sdId, activitySync] of (
    sdWatcherManager?.getActivitySyncs() ?? new Map()
  ).entries()) {
    console.log(`[PowerMonitor] Syncing activity for SD ${sdId}...`);
    void (async () => {
      try {
        const affectedNotes = await activitySync.syncFromOtherInstances();
        console.log(
          `[PowerMonitor] SD ${sdId} activity sync complete, affected notes:`,
          Array.from(affectedNotes)
        );

        // Broadcast updates to all windows if there were changes
        if (affectedNotes.size > 0) {
          const noteIds = Array.from(affectedNotes);
          /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
          for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send('note:externalUpdate', {
              operation: 'sync-resume',
              noteIds,
            });
          }
        }
      } catch (error) {
        console.error(`[PowerMonitor] Failed to sync activity for SD ${sdId}:`, error);
      }
    })();
  }

  // Sync all storage directories - deletion sync
  /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
  for (const [sdId, deletionSync] of (
    sdWatcherManager?.getDeletionSyncs() ?? new Map()
  ).entries()) {
    console.log(`[PowerMonitor] Syncing deletions for SD ${sdId}...`);
    void (async () => {
      try {
        const deletedNotes = await deletionSync.syncFromOtherInstances();
        console.log(
          `[PowerMonitor] SD ${sdId} deletion sync complete, deleted notes:`,
          Array.from(deletedNotes)
        );
        /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
      } catch (error) {
        console.error(`[PowerMonitor] Failed to sync deletions for SD ${sdId}:`, error);
      }
    })();
  }

  // After a delay, scan for notes that exist on disk but not in the database
  // This handles the case where activity sync timeout before CRDT files arrived
  // The delay gives cloud storage time to finish syncing
  setTimeout(() => {
    console.log('[PowerMonitor] Starting note discovery scan...');

    // Get all storage directories
    void (async () => {
      if (!database) {
        console.error('[PowerMonitor] Database not initialized');
        return;
      }

      try {
        const storageDirs = await database.getAllStorageDirs();

        for (const sd of storageDirs) {
          console.log(`[PowerMonitor] Discovering notes for SD ${sd.id}...`);
          try {
            if (crdtManager) {
              const discovered = await discoverNewNotes(sd.id, sd.path, database, crdtManager);
              if (discovered.size > 0) {
                console.log(
                  `[PowerMonitor] Discovered ${discovered.size} new notes in SD ${sd.id}:`,
                  Array.from(discovered)
                );
              } else {
                console.log(`[PowerMonitor] No new notes discovered in SD ${sd.id}`);
              }
            }
          } catch (error: unknown) {
            console.error(`[PowerMonitor] Failed to discover notes for SD ${sd.id}:`, error);
          }
        }

        console.log('[PowerMonitor] Note discovery scan complete');
      } catch (error: unknown) {
        console.error('[PowerMonitor] Failed to get storage directories:', error);
      }
    })();
  }, 5000); // 5 second delay to let cloud storage catch up
});

// Clean up on app quit
// Note: We use before-quit for window state (before windows close)
// and will-quit for async cleanup (after windows close)
let isQuitting = false;
// Track explicit quit requests to ensure quit continues on macOS
// (macOS normally keeps app running when windows close)
let isExplicitQuit = false;

// Save window state BEFORE windows close
// The before-quit event fires before any windows are destroyed
let windowStateSaved = false;
app.on('before-quit', (event) => {
  // Mark that an explicit quit was requested (for window-all-closed on macOS)
  isExplicitQuit = true;

  if (isQuitting || windowStateSaved) return; // Already saved or in shutdown

  // Save window state - this must complete before windows close
  if (windowStateManager) {
    // Prevent quit until we've saved state
    event.preventDefault();
    windowStateSaved = true;

    console.log('[App] Saving window state (before-quit)...');
    const states = windowStateManager.getCurrentState();
    console.log(`[App] Captured ${states.length} window state(s)`);

    // Save to database then continue quit
    void (async () => {
      try {
        await windowStateManager.saveState();
        console.log('[App] Window state saved to database');
      } catch (error) {
        console.error('[App] Failed to save window state:', error);
      }
      // Continue with quit now that state is saved
      app.quit();
    })();
  }
});

app.on('will-quit', (event) => {
  if (isQuitting) {
    // Already cleaned up, allow quit to proceed
    return;
  }

  // Prevent quit until cleanup is done
  event.preventDefault();
  isQuitting = true;

  console.log('[App] Starting graceful shutdown...');

  // In test mode, add a timeout to force quit if cleanup hangs
  const isTestMode = process.env['NODE_ENV'] === 'test';
  if (isTestMode) {
    setTimeout(() => {
      console.warn('[App] Shutdown timeout reached in test mode, forcing quit');
      app.exit(1);
    }, 3000); // 3 second timeout in test mode
  }

  // Perform async cleanup
  void (async () => {
    try {
      // 0. Dispose window state manager (state already saved in before-quit)
      if (windowStateManager) {
        windowStateManager.dispose();
        windowStateManager = null;
      }

      // 1. Flush all pending CRDT updates to disk
      const manager = crdtManager;
      if (manager) {
        console.log('[App] Flushing pending CRDT updates...');
        await manager.flush();
        console.log('[App] CRDT updates flushed successfully');

        // 2. Create snapshots for modified notes (show progress if >5)
        const pendingCount = manager.getPendingSnapshotCount();
        if (pendingCount > 0) {
          console.log(`[App] Creating shutdown snapshots for ${pendingCount} notes...`);

          // Show progress UI if many notes need saving
          const showProgress = pendingCount > 5;
          const progressCallback = showProgress
            ? (current: number, total: number) => {
                BrowserWindow.getAllWindows().forEach((window) => {
                  window.webContents.send('shutdown:progress', { current, total });
                });
              }
            : undefined;

          await manager.flushSnapshots(progressCallback);

          // Signal completion
          if (showProgress) {
            BrowserWindow.getAllWindows().forEach((window) => {
              window.webContents.send('shutdown:complete');
            });
          }

          console.log('[App] Shutdown snapshots created successfully');
        }

        // 3. Destroy CRDT manager
        console.log('[App] Destroying CRDT manager...');
        manager.destroy();
      }

      // 3. Stop web server if running
      if (webServerManager?.isRunning()) {
        console.log('[App] Stopping web server...');
        await webServerManager.stop();
        console.log('[App] Web server stopped');
      }

      // 4. Destroy IPC handlers
      if (ipcHandlers) {
        console.log('[App] Destroying IPC handlers...');
        ipcHandlers.destroy();
      }

      // 5. Clean up all SD watchers and syncs
      if (sdWatcherManager) {
        // Wait for pending syncs with timeout
        await sdWatcherManager.waitForPendingSyncs(5000);
        // Clean up all watchers
        await sdWatcherManager.cleanupAllWatchers();
      }

      // 6. Clear compaction interval
      if (compactionInterval) {
        clearInterval(compactionInterval);
      }

      // 7. Close database
      if (database) {
        console.log('[App] Closing database...');
        await database.close();
        console.log('[App] Database closed successfully');
      }

      // 8. Release profile lock
      if (profileLock) {
        console.log('[App] Releasing profile lock...');
        await profileLock.release();
        console.log('[App] Profile lock released');
      }

      console.log('[App] Graceful shutdown complete');

      // Now allow the app to quit
      // Use exit() instead of quit() because we already prevented will-quit
      // Calling quit() again would re-trigger will-quit causing recursion
      app.exit(0);
    } catch (error: unknown) {
      console.error('[App] Error during graceful shutdown:', error);
      // Still quit even if cleanup fails
      app.exit(1);
    }
  })();
});
