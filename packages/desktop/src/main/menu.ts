/**
 * Application Menu Module
 *
 * Handles creation and management of the application menu.
 * Extracted from main/index.ts to improve modularity.
 */

import { app, BrowserWindow, Menu, shell, clipboard } from 'electron';
import { is } from '@electron-toolkit/utils';
import type { Database } from '@notecove/shared';
import type { IPCHandlers } from './ipc/handlers';
import type { WebServerManager } from './web-server/manager';
import type { WindowStateManager } from './window-state-manager';
import { showProfilePicker } from './profile-picker';

/**
 * Dependencies required by the menu system
 */
export interface MenuDependencies {
  /** Main application window (can be null before creation) */
  mainWindow: BrowserWindow | null;
  /** Sync status window reference (can be null) */
  syncStatusWindow: BrowserWindow | null;
  /** All open windows */
  allWindows: BrowserWindow[];
  /** IPC handlers for menu actions */
  ipcHandlers: IPCHandlers | null;
  /** Database instance */
  database: Database | null;
  /** Web server manager */
  webServerManager: WebServerManager | null;
  /** Window state manager */
  windowStateManager: WindowStateManager | null;
  /** Currently selected profile ID */
  selectedProfileId: string | null;
  /** Function to create new windows */
  createWindow: (options?: {
    noteId?: string;
    minimal?: boolean;
    syncStatus?: boolean;
    noteInfo?: boolean;
    storageInspector?: boolean;
    sdPicker?: boolean;
    targetNoteId?: string;
    noteTitle?: string;
    parentWindow?: BrowserWindow;
    sdId?: string;
    sdPath?: string;
    sdName?: string;
    bounds?: { x: number; y: number; width: number; height: number };
    isMaximized?: boolean;
    isFullScreen?: boolean;
  }) => BrowserWindow;
}

/**
 * Create and set the application menu
 */
export function createMenu(deps: MenuDependencies): void {
  const isMac = process.platform === 'darwin';
  const {
    mainWindow,
    syncStatusWindow,
    allWindows,
    ipcHandlers,
    database,
    webServerManager,
    windowStateManager,
    selectedProfileId,
    createWindow,
  } = deps;

  const template: Electron.MenuItemConstructorOptions[] = [
    // macOS application menu
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              {
                label: 'About NoteCove',
                click: () => {
                  // TODO: Show About dialog
                  if (mainWindow) {
                    mainWindow.webContents.send('menu:about');
                  }
                },
              },
              { type: 'separator' as const },
              {
                label: 'Settings...',
                accelerator: 'Cmd+,',
                click: () => {
                  if (ipcHandlers) {
                    ipcHandlers.openSettings();
                  }
                },
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Note',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            // TODO: Create new note
            if (mainWindow) {
              mainWindow.webContents.send('menu:new-note');
            }
          },
        },
        {
          label: 'New Folder',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => {
            // TODO: Create new folder
            if (mainWindow) {
              mainWindow.webContents.send('menu:new-folder');
            }
          },
        },
        {
          label: 'New Window',
          accelerator: isMac ? 'Cmd+Shift+W' : 'Ctrl+Shift+W',
          click: () => {
            createWindow();
          },
        },
        { type: 'separator' },
        {
          label: 'Export Selected Notes to Markdown...',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu:export-selected-notes');
            }
          },
        },
        {
          label: 'Export All Notes to Markdown...',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu:export-all-notes');
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Import Markdown...',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send('menu:import-markdown');
            } else if (mainWindow) {
              mainWindow.webContents.send('menu:import-markdown');
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Switch Profile...',
          click: () => {
            // Show profile picker and restart with new profile if selected
            void (async () => {
              const appDataDir = app.getPath('userData');
              const isDevBuild = !app.isPackaged;

              const result = await showProfilePicker({
                isDevBuild,
                appDataDir,
              });

              if (result.profileId && result.profileId !== selectedProfileId) {
                // User selected a different profile - restart the app with it
                console.log(`[Profile] Switching to profile: ${result.profileId}`);
                app.relaunch({
                  args: process.argv.slice(1).concat([`--profile-id=${result.profileId}`]),
                });
                app.exit(0);
              }
            })();
          },
        },
        { type: 'separator' },
        // Settings on Windows/Linux only (on macOS it's in App menu)
        ...(!isMac
          ? [
              {
                label: 'Settings...',
                accelerator: 'Ctrl+,',
                click: () => {
                  if (ipcHandlers) {
                    ipcHandlers.openSettings();
                  }
                },
              },
              { type: 'separator' as const },
            ]
          : []),
        {
          label: 'Close Window',
          accelerator: 'CmdOrCtrl+W',
          role: 'close' as const,
        },
        ...(!isMac ? [{ type: 'separator' as const }, { role: 'quit' as const }] : []),
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
        { type: 'separator' },
        {
          label: 'Find...',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            // TODO: Focus search box in UI
            if (mainWindow) {
              mainWindow.webContents.send('menu:find');
            }
          },
        },
        {
          label: 'Find in Note',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => {
            // TODO: Open in-editor search
            if (mainWindow) {
              mainWindow.webContents.send('menu:find-in-note');
            }
          },
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Dark Mode',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: () => {
            // TODO: Toggle dark mode
            if (mainWindow) {
              mainWindow.webContents.send('menu:toggle-dark-mode');
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Toggle Folder Panel',
          accelerator: 'CmdOrCtrl+Shift+1',
          click: () => {
            // TODO: Toggle folder panel
            if (mainWindow) {
              mainWindow.webContents.send('menu:toggle-folder-panel');
            }
          },
        },
        {
          label: 'Toggle Tags Panel',
          accelerator: 'CmdOrCtrl+Shift+2',
          click: () => {
            // TODO: Toggle tags panel (when implemented)
            if (mainWindow) {
              mainWindow.webContents.send('menu:toggle-tags-panel');
            }
          },
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Note Info',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu:noteInfo');
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Create Snapshot',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu:createSnapshot');
            }
          },
        },
        {
          label: 'View History',
          accelerator: 'CmdOrCtrl+Alt+H',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu:viewHistory');
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Sync Status',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu:syncStatus');
            }
          },
        },
        {
          label: 'Storage Inspector',
          click: () => {
            void (async () => {
              if (!database) return;

              // Get all SDs
              const sds = await database.getAllStorageDirs();
              if (sds.length === 0) return;

              // If only one SD, open inspector directly
              if (sds.length === 1 && sds[0]) {
                const sd = sds[0];
                createWindow({
                  storageInspector: true,
                  sdId: sd.id,
                  sdPath: sd.path,
                  sdName: sd.name,
                });
                return;
              }

              // Multiple SDs - open picker window
              createWindow({
                sdPicker: true,
              });
            })();
          },
        },
        { type: 'separator' },
        {
          label: 'Advanced',
          submenu: [
            {
              label: 'Reload Note from CRDT Logs',
              click: () => {
                if (mainWindow) {
                  mainWindow.webContents.send('menu:reloadFromCRDTLogs');
                }
              },
            },
            ...(is.dev
              ? [
                  { type: 'separator' as const },
                  {
                    label: 'Show Window States (Debug)',
                    click: () => {
                      // Debug: Show current window state info
                      const windowInfo = allWindows.map((win, index) => {
                        const bounds = win.getBounds();
                        const isMaximized = win.isMaximized();
                        const isFullScreen = win.isFullScreen();
                        const url = win.webContents.getURL();
                        const urlParams = new URL(url).searchParams;
                        return {
                          index,
                          id: win.id,
                          isMain: win === mainWindow,
                          isSyncStatus: win === syncStatusWindow,
                          bounds,
                          isMaximized,
                          isFullScreen,
                          noteId: urlParams.get('noteId'),
                          minimal: urlParams.get('minimal') === 'true',
                          syncStatus: urlParams.get('syncStatus') === 'true',
                        };
                      });
                      console.log(
                        '[WindowState Debug] Current windows:',
                        JSON.stringify(windowInfo, null, 2)
                      );
                      // Also show in a dialog for easy viewing
                      // eslint-disable-next-line @typescript-eslint/no-require-imports
                      const { dialog } = require('electron') as typeof import('electron');
                      void dialog.showMessageBox({
                        type: 'info',
                        title: 'Window States (Debug)',
                        message: `${allWindows.length} window(s) open`,
                        detail: JSON.stringify(windowInfo, null, 2),
                      });
                    },
                  },
                ]
              : []),
          ],
        },
        { type: 'separator' },
        {
          label: 'Reindex Notes',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu:reindexNotes');
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Web Server',
          submenu: [
            {
              id: 'web-server-toggle',
              label: webServerManager?.isRunning() ? 'Stop Server' : 'Start Server',
              click: () => {
                void (async () => {
                  if (!webServerManager) return;
                  if (webServerManager.isRunning()) {
                    await webServerManager.stop();
                    console.log('[Menu] Web server stopped');
                  } else {
                    const status = await webServerManager.start();
                    console.log(`[Menu] Web server started at ${status.url}`);
                    // Copy connection info to clipboard
                    if (mainWindow && status.url && status.token) {
                      const connectionUrl = `${status.url}?token=${status.token}`;
                      clipboard.writeText(connectionUrl);
                      mainWindow.webContents.send('notification:show', {
                        title: 'Web Server Started',
                        body: `URL copied to clipboard: ${status.url}`,
                      });
                    }
                  }
                  // Refresh menu to update label
                  createMenu(deps);
                })();
              },
            },
            { type: 'separator' as const },
            {
              label: 'Show Connection Info',
              enabled: webServerManager?.isRunning() ?? false,
              click: () => {
                if (mainWindow && webServerManager?.isRunning()) {
                  const status = webServerManager.getStatus();
                  mainWindow.webContents.send('menu:webServerInfo', status);
                }
              },
            },
            {
              label: 'Copy Connection URL',
              enabled: webServerManager?.isRunning() ?? false,
              click: () => {
                void (async () => {
                  if (webServerManager?.isRunning()) {
                    const status = webServerManager.getStatus();
                    const connectionUrl = `${status.url}?token=${status.token}`;
                    clipboard.writeText(connectionUrl);
                    if (mainWindow) {
                      mainWindow.webContents.send('notification:show', {
                        title: 'Connection URL Copied',
                        body: 'URL with token copied to clipboard',
                      });
                    }
                  }
                })();
              },
            },
            { type: 'separator' as const },
            {
              label: 'Regenerate Token',
              enabled: webServerManager !== null,
              click: () => {
                void (async () => {
                  if (webServerManager) {
                    await webServerManager.regenerateToken();
                    if (mainWindow) {
                      mainWindow.webContents.send('notification:show', {
                        title: 'Token Regenerated',
                        body: 'A new access token has been generated. All connected clients will need to reconnect.',
                      });
                    }
                  }
                })();
              },
            },
          ],
        },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const },
              { type: 'separator' as const },
              { role: 'window' as const },
            ]
          : [{ role: 'close' as const }]),
        { type: 'separator' as const },
        {
          label: 'Start Fresh...',
          click: () => {
            // Clear saved window states and restart the app
            void (async () => {
              if (windowStateManager) {
                await windowStateManager.clearState();
                console.log('[WindowState] Cleared saved states for fresh start');
              }
              // Relaunch the app with --fresh flag to skip any residual state
              app.relaunch({ args: [...process.argv.slice(1), '--fresh'] });
              app.quit();
            })();
          },
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => {
            // TODO: Update with actual docs URL when available
            void shell.openExternal('https://github.com/anthropics/notecove/wiki');
          },
        },
        {
          label: 'Report Issue',
          click: () => {
            void shell.openExternal('https://github.com/anthropics/notecove/issues/new');
          },
        },
        { type: 'separator' },
        {
          label: 'Show Logs',
          click: () => {
            const logsPath = app.getPath('logs');
            void shell.openPath(logsPath);
          },
        },
        ...(!isMac
          ? [
              { type: 'separator' as const },
              {
                label: 'About NoteCove',
                click: () => {
                  // TODO: Show About dialog
                  if (mainWindow) {
                    mainWindow.webContents.send('menu:about');
                  }
                },
              },
            ]
          : []),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
