const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Menu actions
  onMenuAction: (callback) => {
    ipcRenderer.on('menu:new-note', callback);
    ipcRenderer.on('menu:save', callback);
  },

  // File system operations
  fileSystem: {
    readFile: (path) => ipcRenderer.invoke('fs:read-file', path),
    writeFile: (path, content) => ipcRenderer.invoke('fs:write-file', path, content),
    exists: (path) => ipcRenderer.invoke('fs:exists', path),
    readDir: (path) => ipcRenderer.invoke('fs:read-dir', path),
    mkdir: (path) => ipcRenderer.invoke('fs:mkdir', path),
    watch: (path, callback) => {
      const id = Math.random().toString(36);
      ipcRenderer.on(`fs:watch:${id}`, callback);
      ipcRenderer.invoke('fs:watch', path, id);
      return id;
    },
    unwatch: (id) => ipcRenderer.invoke('fs:unwatch', id)
  },

  // Settings management
  settings: {
    get: (key) => ipcRenderer.invoke('settings:get', key),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value)
  },

  // Dialog operations
  dialog: {
    showOpen: (options) => ipcRenderer.invoke('dialog:show-open', options),
    showSave: (options) => ipcRenderer.invoke('dialog:show-save', options)
  },

  // App info
  platform: process.platform,
  version: process.versions.electron,
  isElectron: true
});