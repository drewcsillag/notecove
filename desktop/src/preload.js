const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Menu actions
  onMenuAction: (callback) => {
    ipcRenderer.on('menu:new-note', callback);
    ipcRenderer.on('menu:save', callback);
  },

  // File system operations (to be implemented)
  fileSystem: {
    readFile: (path) => ipcRenderer.invoke('fs:read-file', path),
    writeFile: (path, content) => ipcRenderer.invoke('fs:write-file', path, content),
    exists: (path) => ipcRenderer.invoke('fs:exists', path),
    readDir: (path) => ipcRenderer.invoke('fs:read-dir', path),
    watch: (path, callback) => {
      const id = Math.random().toString(36);
      ipcRenderer.on(`fs:watch:${id}`, callback);
      ipcRenderer.invoke('fs:watch', path, id);
      return id;
    },
    unwatch: (id) => ipcRenderer.invoke('fs:unwatch', id)
  },

  // App info
  platform: process.platform,
  version: process.versions.electron
});