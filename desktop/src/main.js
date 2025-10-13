const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const Store = require('electron-store');
const path = require('path');
const fs = require('fs').promises;
const chokidar = require('chokidar');
const os = require('os');
const isDev = process.env.NODE_ENV === 'development';

// Parse command-line arguments for multi-instance support
function parseArgs() {
  const args = process.argv.slice(isDev ? 2 : 1);
  const parsed = {
    userDataDir: null,
    notesPath: null,
    instance: null
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--user-data-dir' && args[i + 1]) {
      parsed.userDataDir = args[i + 1];
      i++;
    } else if (args[i] === '--notes-path' && args[i + 1]) {
      parsed.notesPath = args[i + 1];
      i++;
    } else if (args[i] === '--instance' && args[i + 1]) {
      parsed.instance = args[i + 1];
      i++;
    }
  }

  return parsed;
}

const cmdArgs = parseArgs();

// Set custom user data directory if provided (for multiple instances)
if (cmdArgs.userDataDir) {
  app.setPath('userData', cmdArgs.userDataDir);
  console.log('Using custom user data directory:', cmdArgs.userDataDir);
}

// Set custom notes path for this instance
const customNotesPath = cmdArgs.notesPath ||
  (cmdArgs.instance ? path.join(os.homedir(), 'Documents', `NoteCove-${cmdArgs.instance}`) : null);

class NoteCoveApp {
  constructor() {
    this.mainWindow = null;
    this.watchers = new Map(); // File system watchers
    this.instanceName = cmdArgs.instance || 'default';

    // Default notes path considers instance name
    const defaultNotesPath = customNotesPath || path.join(os.homedir(), 'Documents', 'NoteCove');

    this.store = new Store({
      defaults: {
        windowGeometry: { width: 1200, height: 800 },
        theme: 'auto',
        lastOpenNote: null,
        notesPath: defaultNotesPath,
        documentsPath: path.join(os.homedir(), 'Documents')
      }
    });

    // Override notesPath if custom path provided
    if (customNotesPath) {
      this.store.set('notesPath', customNotesPath);
    }

    console.log('Instance:', this.instanceName);
    console.log('Notes path:', this.store.get('notesPath'));

    this.setupApp();
    this.setupIPC();
  }

  setupApp() {
    // Handle app ready
    app.whenReady().then(() => {
      this.createMainWindow();
      this.setupMenu();

      // Handle window-all-closed (except on macOS)
      app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
          app.quit();
        }
      });

      // Handle activate (macOS)
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createMainWindow();
        }
      });
    });

    // Security: Prevent new window creation
    app.on('web-contents-created', (event, contents) => {
      contents.on('new-window', (event, url) => {
        event.preventDefault();
      });
    });
  }

  createMainWindow() {
    const geometry = this.store.get('windowGeometry');

    this.mainWindow = new BrowserWindow({
      width: geometry.width || 1200,
      height: geometry.height || 800,
      x: geometry.x,
      y: geometry.y,
      minWidth: 800,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, 'preload.js')
      },
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      show: false, // Don't show until ready
      icon: path.join(__dirname, '../assets/icon.png') // Will add icon later
    });

    // Load the app
    if (isDev) {
      this.mainWindow.loadURL('http://localhost:5173');
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Show window when ready and send initial maximize state
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
      // Send initial maximize state
      const isMaximized = this.mainWindow.isMaximized();
      console.log('Initial window maximized state:', isMaximized);
      this.mainWindow.webContents.send('window:maximized', isMaximized);
    });

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Save window geometry on resize and move
    this.mainWindow.on('resize', () => this.saveWindowGeometry());
    this.mainWindow.on('move', () => this.saveWindowGeometry());

    // Track window maximize state changes
    this.mainWindow.on('maximize', () => {
      console.log('Window maximized');
      this.mainWindow.webContents.send('window:maximized', true);
    });

    this.mainWindow.on('unmaximize', () => {
      console.log('Window unmaximized');
      this.mainWindow.webContents.send('window:maximized', false);
    });
  }

  saveWindowGeometry() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      const bounds = this.mainWindow.getBounds();
      this.store.set('windowGeometry', bounds);
    }
  }

  setupIPC() {
    // File system operations (will be implemented in later commits)
    ipcMain.handle('fs:read-file', async (event, filePath) => {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        return { success: true, content };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('fs:write-file', async (event, filePath, content) => {
      try {
        // Ensure directory exists
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });

        await fs.writeFile(filePath, content, 'utf8');
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('fs:exists', async (event, filePath) => {
      try {
        await fs.access(filePath);
        return true;
      } catch {
        return false;
      }
    });

    ipcMain.handle('fs:read-dir', async (event, dirPath) => {
      try {
        const files = await fs.readdir(dirPath);
        return { success: true, files };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Settings management
    ipcMain.handle('settings:get', (event, key) => {
      return this.store.get(key);
    });

    ipcMain.handle('settings:set', (event, key, value) => {
      this.store.set(key, value);
      return true;
    });

    // File watching
    ipcMain.handle('fs:watch', async (event, watchPath, watchId) => {
      try {
        if (this.watchers.has(watchId)) {
          await this.watchers.get(watchId).close();
        }

        const watcher = chokidar.watch(watchPath, {
          ignored: /(^|[\/\\])\../, // ignore dotfiles
          persistent: true,
          ignoreInitial: true
        });

        watcher.on('all', (eventType, filePath) => {
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send(`fs:watch:${watchId}`, {
              event: eventType,
              path: filePath
            });
          }
        });

        this.watchers.set(watchId, watcher);
        return { success: true, watchId };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('fs:unwatch', async (event, watchId) => {
      try {
        if (this.watchers.has(watchId)) {
          await this.watchers.get(watchId).close();
          this.watchers.delete(watchId);
        }
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Directory operations
    ipcMain.handle('fs:mkdir', async (event, dirPath) => {
      try {
        await fs.mkdir(dirPath, { recursive: true });
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Delete file
    ipcMain.handle('fs:delete-file', async (event, filePath) => {
      try {
        await fs.unlink(filePath);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Dialog operations
    ipcMain.handle('dialog:show-open', async (event, options) => {
      const result = await dialog.showOpenDialog(this.mainWindow, options);
      return result;
    });

    ipcMain.handle('dialog:show-save', async (event, options) => {
      const result = await dialog.showSaveDialog(this.mainWindow, options);
      return result;
    });

    ipcMain.handle('dialog:show-message-box', async (event, options) => {
      const result = await dialog.showMessageBox(this.mainWindow, options);
      return result;
    });
  }

  setupMenu() {
    const template = [
      {
        label: 'File',
        submenu: [
          {
            label: 'New Note',
            accelerator: 'CmdOrCtrl+N',
            click: () => {
              this.sendToRenderer('menu:new-note');
            }
          },
          {
            label: 'Save',
            accelerator: 'CmdOrCtrl+S',
            click: () => {
              this.sendToRenderer('menu:save');
            }
          },
          { type: 'separator' },
          {
            label: 'Quit',
            accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
            click: () => {
              app.quit();
            }
          }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
          { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
          { type: 'separator' },
          { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
          { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
          { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
          { label: 'Select All', accelerator: 'CmdOrCtrl+A', role: 'selectall' }
        ]
      },
      {
        label: 'View',
        submenu: [
          { label: 'Reload', accelerator: 'CmdOrCtrl+R', role: 'reload' },
          { label: 'Force Reload', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
          { label: 'Toggle Developer Tools', accelerator: 'F12', role: 'toggleDevTools' },
          { type: 'separator' },
          { label: 'Actual Size', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
          { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
          { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
          { type: 'separator' },
          { label: 'Toggle Fullscreen', accelerator: 'F11', role: 'togglefullscreen' }
        ]
      }
    ];

    // macOS specific menu adjustments
    if (process.platform === 'darwin') {
      template.unshift({
        label: app.getName(),
        submenu: [
          { label: 'About NoteCove', role: 'about' },
          { type: 'separator' },
          { label: 'Services', role: 'services', submenu: [] },
          { type: 'separator' },
          { label: 'Hide NoteCove', accelerator: 'Command+H', role: 'hide' },
          { label: 'Hide Others', accelerator: 'Command+Shift+H', role: 'hideothers' },
          { label: 'Show All', role: 'unhide' },
          { type: 'separator' },
          { label: 'Quit', accelerator: 'Command+Q', click: () => app.quit() }
        ]
      });
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  sendToRenderer(channel, ...args) {
    if (this.mainWindow && this.mainWindow.webContents) {
      this.mainWindow.webContents.send(channel, ...args);
    }
  }
}

// Initialize app
new NoteCoveApp();