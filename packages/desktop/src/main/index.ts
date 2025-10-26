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
} from '@notecove/shared';
import { IPCHandlers } from './ipc/handlers';
import { CRDTManagerImpl } from './crdt/crdt-manager';
import { NodeFileSystemAdapter } from './storage/node-fs-adapter';
import { NodeFileWatcher } from './storage/node-file-watcher';
import { randomUUID } from 'crypto';

let mainWindow: BrowserWindow | null = null;
let database: Database | null = null;
let ipcHandlers: IPCHandlers | null = null;
let fileWatcher: NodeFileWatcher | null = null;
let activityWatcher: NodeFileWatcher | null = null;
let compactionInterval: NodeJS.Timeout | null = null;
const allWindows: BrowserWindow[] = [];

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

// App lifecycle
// Create application menu
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

    // Initialize UpdateManager with instance ID
    const instanceId = process.env['INSTANCE_ID'] ?? randomUUID();
    const updateManager = new UpdateManager(fsAdapter, sdStructure, instanceId);

    // Initialize CRDT manager
    // Type assertion needed due to TypeScript module resolution quirk between dist and src
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    const crdtManager = new CRDTManagerImpl(updateManager as any);

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

    // Initialize activity sync with callbacks
    const activitySyncCallbacks: ActivitySyncCallbacks = {
      reloadNote: async (noteId: string) => {
        await crdtManager.reloadNote(noteId);
      },
      getLoadedNotes: () => crdtManager.getLoadedNotes(),
    };
    const activitySync = new ActivitySync(
      fsAdapter,
      instanceId,
      activityDir,
      activitySyncCallbacks
    );

    // Clean up orphaned activity logs on startup
    await activitySync.cleanupOrphanedLogs();

    // Eagerly load folder tree to trigger demo folder creation
    // This ensures demo folders are created while we know the updates directory exists
    crdtManager.loadFolderTree('default');

    // Initialize IPC handlers (pass createWindow for testing support)
    ipcHandlers = new IPCHandlers(crdtManager, database, createWindow);

    // Set up file watcher for cross-instance folder sync
    fileWatcher = new NodeFileWatcher();
    await fileWatcher.watch(folderUpdatesPath, (event) => {
      console.log('[FileWatcher] Detected folder update file change:', event.filename);

      // Ignore directory creation events and temporary files
      if (event.filename === 'updates' || event.filename.endsWith('.tmp')) {
        return;
      }

      // Only process .yjson files
      if (!event.filename.endsWith('.yjson')) {
        return;
      }

      // Reload folder tree from disk
      const folderTree = crdtManager.getFolderTree('default');
      if (folderTree) {
        // Load all updates from disk (this will merge with existing state)
        updateManager
          .readFolderUpdates()
          .then((updates) => {
            for (const update of updates) {
              folderTree.applyUpdate(update);
            }

            // Broadcast update to all windows
            const windows = BrowserWindow.getAllWindows();
            for (const window of windows) {
              window.webContents.send('folder:updated', {
                sdId: 'default',
                operation: 'external-sync',
                folderId: 'unknown',
              });
            }
          })
          .catch((err) => {
            console.error('[FileWatcher] Failed to reload folder updates:', err);
          });
      }
    });

    // Set up file watcher for cross-instance note sync
    activityWatcher = new NodeFileWatcher();
    await activityWatcher.watch(activityDir, (event) => {
      console.log('[ActivityWatcher] Detected activity log change:', event.filename);

      // Ignore directory creation events and our own log file
      if (event.filename === '.activity' || event.filename === `${instanceId}.log`) {
        return;
      }

      // Only process .log files
      if (!event.filename.endsWith('.log')) {
        return;
      }

      // Sync from other instances (wrapped in void to handle async in sync callback)
      void (async () => {
        try {
          const affectedNotes = await activitySync.syncFromOtherInstances();

          if (affectedNotes.size > 0) {
            // Broadcast update to all windows
            const windows = BrowserWindow.getAllWindows();
            for (const window of windows) {
              window.webContents.send('note:external-update', {
                operation: 'external-sync',
                noteIds: Array.from(affectedNotes),
              });
            }
          }
        } catch (error) {
          console.error('[ActivityWatcher] Failed to sync from other instances:', error);
        }
      })();
    });

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
    if (fileWatcher) {
      void fileWatcher.unwatch();
    }
    if (activityWatcher) {
      void activityWatcher.unwatch();
    }
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
