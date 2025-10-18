import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Type definitions for the Electron API exposed to the renderer
interface FileSystemAPI {
  readFile: (path: string) => Promise<{ success: boolean; content?: Uint8Array; error?: string }>;
  writeFile: (path: string, content: string | Uint8Array) => Promise<{ success: boolean; error?: string }>;
  exists: (path: string) => Promise<boolean>;
  readDir: (path: string) => Promise<{ success: boolean; files?: string[]; error?: string }>;
  mkdir: (path: string) => Promise<{ success: boolean; error?: string }>;
  deleteFile: (path: string) => Promise<{ success: boolean; error?: string }>;
  deleteDir: (path: string) => Promise<{ success: boolean; error?: string }>;
  watch: (path: string, watchId: string) => Promise<{ success: boolean; watchId?: string; error?: string }>;
  unwatch: (watchId: string) => Promise<{ success: boolean; error?: string }>;
  expandPath: (path: string) => Promise<string>;
  listDirectory: (path: string) => Promise<string[]>;
  getUserDataPath: () => Promise<string>;
}

interface SystemAPI {
  getPlatform: () => Promise<string>;
}

interface FileChangeData {
  event: string;
  path: string;
}

interface SettingsAPI {
  get: <T = any>(key: string) => Promise<T>;
  set: (key: string, value: any) => Promise<boolean>;
}

interface DialogAPI {
  showOpen: (options: Electron.OpenDialogOptions) => Promise<Electron.OpenDialogReturnValue>;
  showSave: (options: Electron.SaveDialogOptions) => Promise<Electron.SaveDialogReturnValue>;
  showMessageBox: (options: Electron.MessageBoxOptions) => Promise<Electron.MessageBoxReturnValue>;
}

export interface ElectronAPI {
  // Menu actions
  onMenuAction: (callback: (action: string) => void) => void;

  // App lifecycle
  onSaveBeforeQuit: (callback: () => void) => void;

  // Window state
  onWindowMaximized: (callback: (isMaximized: boolean) => void) => void;

  // File system operations
  fileSystem: FileSystemAPI;

  // System operations
  system: SystemAPI;

  // File change events
  onFileChange: (watchId: string, callback: (event: IpcRendererEvent, data: FileChangeData) => void) => void;

  // Settings management
  settings: SettingsAPI;

  // Dialog operations
  dialog: DialogAPI;

  // App info
  platform: NodeJS.Platform;
  version: string;
  isElectron: boolean;
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Menu actions
  onMenuAction: (callback: (action: string) => void) => {
    ipcRenderer.on('menu:new-note', () => callback('menu:new-note'));
    ipcRenderer.on('menu:save', () => callback('menu:save'));
  },

  // App lifecycle
  onSaveBeforeQuit: (callback: () => void) => {
    ipcRenderer.on('save-before-quit', () => callback());
  },

  // Window state
  onWindowMaximized: (callback: (isMaximized: boolean) => void) => {
    ipcRenderer.on('window:maximized', (_event: IpcRendererEvent, isMaximized: boolean) => callback(isMaximized));
  },

  // File system operations
  fileSystem: {
    readFile: (path: string) => ipcRenderer.invoke('fs:read-file', path),
    writeFile: (path: string, content: string) => ipcRenderer.invoke('fs:write-file', path, content),
    exists: (path: string) => ipcRenderer.invoke('fs:exists', path),
    readDir: (path: string) => ipcRenderer.invoke('fs:read-dir', path),
    mkdir: (path: string) => ipcRenderer.invoke('fs:mkdir', path),
    deleteFile: (path: string) => ipcRenderer.invoke('fs:delete-file', path),
    deleteDir: (path: string) => ipcRenderer.invoke('fs:delete-dir', path),
    watch: async (path: string, watchId: string) => {
      // Set up listener for this watch ID
      return await ipcRenderer.invoke('fs:watch', path, watchId);
    },
    unwatch: (watchId: string) => ipcRenderer.invoke('fs:unwatch', watchId),
    expandPath: (path: string) => ipcRenderer.invoke('fs:expand-path', path),
    listDirectory: (path: string) => ipcRenderer.invoke('fs:list-directory', path),
    getUserDataPath: () => ipcRenderer.invoke('fs:get-user-data-path')
  },

  // System operations
  system: {
    getPlatform: () => ipcRenderer.invoke('system:get-platform')
  },

  // File change events
  onFileChange: (watchId: string, callback: (event: IpcRendererEvent, data: FileChangeData) => void) => {
    ipcRenderer.on(`fs:watch:${watchId}`, (event: IpcRendererEvent, data: FileChangeData) => {
      callback(event, data);
    });
  },

  // Settings management
  settings: {
    get: <T = any>(key: string): Promise<T> => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: any): Promise<boolean> => ipcRenderer.invoke('settings:set', key, value)
  },

  // Dialog operations
  dialog: {
    showOpen: (options: Electron.OpenDialogOptions) => ipcRenderer.invoke('dialog:show-open', options),
    showSave: (options: Electron.SaveDialogOptions) => ipcRenderer.invoke('dialog:show-save', options),
    showMessageBox: (options: Electron.MessageBoxOptions) => ipcRenderer.invoke('dialog:show-message-box', options)
  },

  // App info
  platform: process.platform,
  version: process.versions.electron,
  isElectron: true
} as ElectronAPI);
