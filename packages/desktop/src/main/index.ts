/**
 * Electron Main Process
 */

import { app, BrowserWindow, Menu, shell } from 'electron';
import { join } from 'path';
import { is } from '@electron-toolkit/utils';
import { BetterSqliteAdapter, SqliteDatabase } from './database';
import type { Database } from '@notecove/shared';
import {
  UpdateManager,
  SyncDirectoryStructure,
  ActivityLogger,
  ActivitySync,
  type ActivitySyncCallbacks,
  extractTitleFromDoc,
} from '@notecove/shared';
import { IPCHandlers } from './ipc/handlers';
import { CRDTManagerImpl, type CRDTManager } from './crdt';
import { NodeFileSystemAdapter } from './storage/node-fs-adapter';
import { NodeFileWatcher } from './storage/node-file-watcher';
import { randomUUID } from 'crypto';
import * as Y from 'yjs';

let mainWindow: BrowserWindow | null = null;
let database: Database | null = null;
let ipcHandlers: IPCHandlers | null = null;
let compactionInterval: NodeJS.Timeout | null = null;
const allWindows: BrowserWindow[] = [];

// Multi-SD support: Store watchers and activity syncs per SD
const sdFileWatchers = new Map<string, NodeFileWatcher>();
const sdActivityWatchers = new Map<string, NodeFileWatcher>();
const sdActivitySyncs = new Map<string, ActivitySync>();


function createWindow(): void {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    if (mainWindow) {
      const index = allWindows.indexOf(mainWindow);
      if (index > -1) {
        allWindows.splice(index, 1);
      }
    }
    mainWindow = null;
  });

  // Track window
  allWindows.push(mainWindow);

  // Load the renderer
  // In test mode, always use the built files, not the dev server
  if (process.env['NODE_ENV'] === 'test' || !is.dev || !process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  } else {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  }
}

/**
 * Initialize database
 */
async function initializeDatabase(): Promise<Database> {
  // Determine database path based on platform
  const userDataPath = app.getPath('userData');
  const dbPath = join(userDataPath, 'notecove.db');

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

/**
 * Ensure a default note exists for the user
 */
async function ensureDefaultNote(db: Database, crdtMgr: CRDTManager): Promise<void> {
  const DEFAULT_NOTE_ID = 'default-note';

  // Ensure default SD exists
  let DEFAULT_SD_ID: string;
  const existingSDs = await db.getAllStorageDirs();
  if (existingSDs.length === 0) {
    // Create default SD
    const defaultPath = join(app.getPath('documents'), 'NoteCove');
    DEFAULT_SD_ID = 'default';
    await db.createStorageDir(DEFAULT_SD_ID, 'Default', defaultPath);
    console.log('[Main] Created default SD at:', defaultPath);
  } else {
    // Use the active SD or the first one
    const activeSD = await db.getActiveStorageDir();
    DEFAULT_SD_ID = activeSD ? activeSD.id : (existingSDs[0]?.id ?? 'default');
    console.log('[Main] Using existing SD:', DEFAULT_SD_ID);
  }

  // Check if the default note exists
  const existingNotes = await db.getNotesBySd(DEFAULT_SD_ID);
  const defaultNote = existingNotes.find((note) => note.id === DEFAULT_NOTE_ID);

  if (defaultNote) {
    // Default note exists, check if it has content
    console.log('[ensureDefaultNote] Found default note, checking content');
    await crdtMgr.loadNote(DEFAULT_NOTE_ID, DEFAULT_SD_ID);
    const doc = crdtMgr.getDocument(DEFAULT_NOTE_ID);
    if (doc) {
      const content = doc.getXmlFragment('content');
      if (content.length === 0) {
        // No content, add the welcome message
        console.log('[ensureDefaultNote] Default note is empty, adding content');
        const paragraph = new Y.XmlElement('paragraph');
        const text = new Y.XmlText();
        text.insert(
          0,
          'Welcome to NoteCove! Open multiple windows to see real-time collaboration in action.'
        );
        paragraph.insert(0, [text]);
        content.insert(0, [paragraph]);
      }
    }
    await db.setState('selectedNoteId', DEFAULT_NOTE_ID);
    return;
  }

  // Check if any other notes exist
  if (existingNotes.length > 0) {
    // Other notes exist, select the first one
    const firstNote = existingNotes[0];
    if (firstNote) {
      console.log(
        '[ensureDefaultNote] Found existing note:',
        firstNote.id,
        'title:',
        firstNote.title
      );
      await db.setState('selectedNoteId', firstNote.id);
    }
    return;
  }

  console.log('[ensureDefaultNote] No existing notes in database, loading from CRDT');

  // No notes exist in database, but CRDT files might exist
  // Load the note to check if it already has content from sync directory
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  await crdtMgr.loadNote(DEFAULT_NOTE_ID, DEFAULT_SD_ID);

  // Get the document to check/insert initial content
  const doc = crdtMgr.getDocument(DEFAULT_NOTE_ID);
  if (doc) {
    // Check if content already exists (from sync directory)
    const content = doc.getXmlFragment('content');
    if (content.length === 0) {
      // Only add welcome content if CRDT is truly empty
      console.log('[ensureDefaultNote] CRDT is empty, adding welcome content');
      // ProseMirror structure: paragraph containing text
      const paragraph = new Y.XmlElement('paragraph');
      const text = new Y.XmlText();
      text.insert(
        0,
        'Welcome to NoteCove! Open multiple windows to see real-time collaboration in action.'
      );
      paragraph.insert(0, [text]);
      content.insert(0, [paragraph]);
    } else {
      console.log(
        '[ensureDefaultNote] CRDT already has content from sync directory, skipping welcome content'
      );
    }
  }

  // Create note cache entry in SQLite
  await db.upsertNote({
    id: DEFAULT_NOTE_ID,
    title: 'Welcome to NoteCove',
    sdId: DEFAULT_SD_ID,
    folderId: null,
    created: Date.now(),
    modified: Date.now(),
    deleted: false,
    contentPreview: 'Welcome to NoteCove!',
    contentText:
      'Welcome to NoteCove! Open multiple windows to see real-time collaboration in action.',
  });

  // Set as selected note
  await db.setState('selectedNoteId', DEFAULT_NOTE_ID);
}

// App lifecycle
// Create application menu
/**
 * Set up file watchers and activity sync for a Storage Directory
 */
async function setupSDWatchers(
  sdId: string,
  sdPath: string,
  fsAdapter: NodeFileSystemAdapter,
  instanceId: string,
  updateManager: UpdateManager,
  crdtManager: CRDTManager
): Promise<void> {
  console.log(`[Init] Setting up watchers for SD: ${sdId} at ${sdPath}`);

  const folderUpdatesPath = join(sdPath, 'folders', 'updates');
  const activityDir = join(sdPath, '.activity');

  // Create ActivitySync for this SD
  const activitySyncCallbacks: ActivitySyncCallbacks = {
    reloadNote: async (noteId: string, sdIdFromSync: string) => {
      try {
        if (!database) {
          console.error('[ActivitySync] Database not initialized');
          return;
        }

        const existingNote = await database.getNote(noteId);

        if (!existingNote) {
          // Note created in another instance
          await crdtManager.loadNote(noteId, sdIdFromSync);

          // Extract metadata and insert into database
          const noteDoc = crdtManager.getNoteDoc(noteId);
          const doc = crdtManager.getDocument(noteId);
          if (!doc) {
            console.error(`[ActivitySync] Failed to get document for note ${noteId}`);
            return;
          }

          const crdtMetadata = noteDoc?.getMetadata();
          const folderId = crdtMetadata?.folderId ?? null;

          await database.upsertNote({
            id: noteId,
            title: extractTitleFromDoc(doc, 'content'),
            sdId: sdIdFromSync,
            folderId,
            created: crdtMetadata?.created ?? Date.now(),
            modified: crdtMetadata?.modified ?? Date.now(),
            deleted: crdtMetadata?.deleted ?? false,
            contentPreview: '',
            contentText: '',
          });

          // Broadcast to all windows
          for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send('note:created', { sdId: sdIdFromSync, noteId, folderId });
          }
        } else {
          // Note exists, just reload if currently loaded
          await crdtManager.reloadNote(noteId);
        }
      } catch (error) {
        console.error(`[ActivitySync] Error in reloadNote callback:`, error);
      }
    },
    getLoadedNotes: () => crdtManager.getLoadedNotes(),
  };

  const activitySync = new ActivitySync(
    fsAdapter,
    instanceId,
    activityDir,
    sdId,
    activitySyncCallbacks
  );

  // Clean up orphaned activity logs on startup
  await activitySync.cleanupOrphanedLogs();

  // Store the ActivitySync instance
  sdActivitySyncs.set(sdId, activitySync);

  // Set up folder updates watcher
  const folderWatcher = new NodeFileWatcher();
  await folderWatcher.watch(folderUpdatesPath, (event) => {
    console.log(`[FileWatcher ${sdId}] Detected folder update file change:`, event.filename);

    // Ignore directory creation events and temporary files
    if (event.filename === 'updates' || event.filename.endsWith('.tmp')) {
      return;
    }

    // Only process .yjson files
    if (!event.filename.endsWith('.yjson')) {
      return;
    }

    // Reload folder tree from disk
    const folderTree = crdtManager.getFolderTree(sdId);
    if (folderTree) {
      updateManager
        .readFolderUpdates(sdId)
        .then((updates) => {
          for (const update of updates) {
            folderTree.applyUpdate(update);
          }

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
          console.error(`[FileWatcher ${sdId}] Failed to reload folder updates:`, err);
        });
    }
  });

  sdFileWatchers.set(sdId, folderWatcher);

  // Set up activity watcher
  const activityWatcher = new NodeFileWatcher();
  await activityWatcher.watch(activityDir, (event) => {
    console.log(`[ActivityWatcher ${sdId}] Detected activity log change:`, event.filename);

    // Ignore directory creation events and our own log file
    if (event.filename === '.activity' || event.filename === `${instanceId}.log`) {
      return;
    }

    // Only process .log files
    if (!event.filename.endsWith('.log')) {
      return;
    }

    // Sync from other instances
    void (async () => {
      try {
        const affectedNotes = await activitySync.syncFromOtherInstances();

        // Broadcast updates to all windows for affected notes
        if (affectedNotes.size > 0) {
          for (const window of BrowserWindow.getAllWindows()) {
            for (const noteId of affectedNotes) {
              window.webContents.send('note:externalUpdate', { noteId });
            }
          }
        }
      } catch (error) {
        console.error(`[ActivityWatcher ${sdId}] Failed to sync from other instances:`, error);
      }
    })();
  });

  sdActivityWatchers.set(sdId, activityWatcher);

  console.log(`[Init] Watchers set up successfully for SD: ${sdId}`);
}

function createMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            createWindow();
          },
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'close' }],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Demo: Open 2nd Window',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => {
            createWindow();
          },
        },
        { type: 'separator' },
        {
          label: 'Learn More',
          click: () => {
            void shell.openExternal('https://github.com/anthropics/notecove');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

void app.whenReady().then(async () => {
  try {
    if (process.env['NODE_ENV'] === 'test') {
      console.log('[TEST MODE] App ready, starting initialization...');
    }

    // Initialize database
    database = await initializeDatabase();

    if (process.env['NODE_ENV'] === 'test') {
      console.log('[TEST MODE] Database ready, initializing CRDT manager...');
    }

    // Initialize file system adapter
    const fsAdapter = new NodeFileSystemAdapter();

    // Determine storage directory (shared across instances for sync)
    const storageDir = process.env['TEST_STORAGE_DIR'] ?? join(app.getPath('userData'), 'storage');

    // Initialize SD structure with config
    const sdConfig = {
      id: 'default',
      path: storageDir,
      label: 'Default Storage',
    };
    const sdStructure = new SyncDirectoryStructure(fsAdapter, sdConfig);

    // Initialize SD directory structure
    await sdStructure.initialize();

    // Ensure updates directory exists BEFORE creating CRDT manager
    // This prevents ENOENT errors when demo folders are created
    const folderUpdatesPath = join(storageDir, 'folders', 'updates');
    await fsAdapter.mkdir(folderUpdatesPath);

    // Initialize UpdateManager with instance ID (multi-SD aware)
    const instanceId = process.env['INSTANCE_ID'] ?? randomUUID();
    const updateManager = new UpdateManager(fsAdapter, instanceId);

    // Register the default SD
    updateManager.registerSD('default', storageDir);

    // Load all Storage Directories from database and register them
    const allSDs = database ? await database.getAllStorageDirs() : [];
    for (const sd of allSDs) {
      if (sd.id !== 'default') {
        // Default is already registered above
        updateManager.registerSD(sd.id, sd.path);
        console.log(`[Init] Registered SD: ${sd.name} at ${sd.path}`);
      }
    }

    // Initialize CRDT manager with database reference
    // Type assertion needed due to TypeScript module resolution quirk between dist and src
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    const crdtManager = new CRDTManagerImpl(updateManager as any, database);

    // Initialize activity logger for note sync
    const activityDir = join(storageDir, '.activity');
    await fsAdapter.mkdir(activityDir);

    const activityLogger = new ActivityLogger(fsAdapter, activityDir);
    activityLogger.setInstanceId(instanceId);
    await activityLogger.initialize();

    // Set activity logger on CRDT manager
    // Type assertion needed due to TypeScript module resolution quirk between dist and src
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    crdtManager.setActivityLogger(activityLogger as any);

    // Eagerly load folder tree to trigger demo folder creation
    // This ensures demo folders are created while we know the updates directory exists
    crdtManager.loadFolderTree('default');

    // Handler for when new SD is created (for IPC)
    const handleNewStorageDir = async (sdId: string, sdPath: string): Promise<void> => {
      console.log(`[Init] Initializing new SD: ${sdId} at ${sdPath}`);

      // 1. Create SD config and initialize structure
      const sdConfig = { id: sdId, path: sdPath, label: '' };
      const newSdStructure = new SyncDirectoryStructure(fsAdapter, sdConfig);
      await newSdStructure.initialize();

      // 2. Ensure activity directory exists (required for watchers)
      const activityDir = join(sdPath, '.activity');
      await fsAdapter.mkdir(activityDir);

      // 3. Register with UpdateManager
      updateManager.registerSD(sdId, sdPath);

      // 4. Load folder tree for this SD
      crdtManager.loadFolderTree(sdId);

      // 5. Set up watchers for this SD
      await setupSDWatchers(sdId, sdPath, fsAdapter, instanceId, updateManager, crdtManager);

      console.log(`[Init] Successfully initialized new SD: ${sdId}`);
    };

    // Initialize IPC handlers (pass createWindow for testing support and SD callback)
    ipcHandlers = new IPCHandlers(crdtManager, database, createWindow, handleNewStorageDir);

    // Create default note if none exists
    await ensureDefaultNote(database, crdtManager);

    // Set up watchers for default SD
    await setupSDWatchers('default', storageDir, fsAdapter, instanceId, updateManager, crdtManager);

    // Set up watchers for all other registered SDs
    for (const sd of allSDs) {
      if (sd.id !== 'default') {
        await setupSDWatchers(sd.id, sd.path, fsAdapter, instanceId, updateManager, crdtManager);
      }
    }

    // Periodic compaction of activity log (every 5 minutes)
    compactionInterval = setInterval(
      () => {
        activityLogger.compact().catch((err) => {
          console.error('[ActivityLogger] Failed to compact log:', err);
        });
      },
      5 * 60 * 1000
    );

    if (process.env['NODE_ENV'] === 'test') {
      console.log('[TEST MODE] IPC handlers ready, creating window...');
    }

    // Create menu
    createMenu();

    createWindow();

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
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up on app quit
// Note: We handle cleanup synchronously to avoid race conditions during quit
let isQuitting = false;

app.on('before-quit', () => {
  if (isQuitting) return;
  isQuitting = true;

  try {
    if (ipcHandlers) {
      ipcHandlers.destroy();
    }
    // Clean up all SD file watchers
    for (const watcher of sdFileWatchers.values()) {
      void watcher.unwatch();
    }
    sdFileWatchers.clear();
    // Clean up all SD activity watchers
    for (const watcher of sdActivityWatchers.values()) {
      void watcher.unwatch();
    }
    sdActivityWatchers.clear();
    sdActivitySyncs.clear();
    if (compactionInterval) {
      clearInterval(compactionInterval);
    }
    // Note: Database cleanup is async, but we can't await here
    // The database will be closed when the process exits
    if (database) {
      void database.close();
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
});
