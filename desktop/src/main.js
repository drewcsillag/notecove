const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

class NoteCoveApp {
  constructor() {
    this.mainWindow = null;
    this.setupApp();
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
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, 'preload.js')
      },
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      show: false // Don't show until ready
    });

    // Load the app
    if (isDev) {
      this.mainWindow.loadURL('http://localhost:5173');
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Show window when ready
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
    });

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
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