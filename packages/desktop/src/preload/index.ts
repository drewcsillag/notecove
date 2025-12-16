/**
 * Electron Preload Script
 *
 * This script runs in a sandboxed context with access to both Node.js APIs
 * and the renderer's DOM. It exposes safe IPC methods to the renderer.
 */

import { contextBridge, ipcRenderer } from 'electron';

// Import all API modules
import { noteApi, historyApi, tagApi, linkApi } from './api/note-api';
import { folderApi } from './api/folder-api';
import { sdApi } from './api/sd-api';
import { syncApi, recoveryApi } from './api/sync-api';
import { appStateApi, configApi, telemetryApi, shellApi, clipboardApi, profileApi, appApi } from './api/app-api';
import { backupApi, diagnosticsApi } from './api/backup-api';
import { windowStateApi, windowApi, menuApi, shutdownApi } from './api/window-api';
import { imageApi, thumbnailApi } from './api/image-api';
import { commentApi, mentionApi } from './api/comment-api';
import { toolsApi, exportApi, importApi, testingApi, webServerApi, inspectorApi } from './api/misc-api';

// Expose IPC API to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,

  // Note operations
  note: noteApi,

  // History operations
  history: historyApi,

  // Tag operations
  tag: tagApi,

  // Link operations
  link: linkApi,

  // Folder operations
  folder: folderApi,

  // Storage Directory operations
  sd: sdApi,

  // Sync operations
  sync: syncApi,

  // App state operations
  appState: appStateApi,

  // Shutdown progress operations
  shutdown: shutdownApi,

  // Config operations
  config: configApi,

  // Telemetry operations
  telemetry: telemetryApi,

  // Recovery operations
  recovery: recoveryApi,

  // Diagnostics operations
  diagnostics: diagnosticsApi,

  // Backup and restore operations
  backup: backupApi,

  // Menu event listeners
  menu: menuApi,

  // Tools operations
  tools: toolsApi,

  // Export operations
  export: exportApi,

  // Import operations
  import: importApi,

  // Testing operations (only available if main process registered handler)
  testing: testingApi,

  // Web Server operations
  webServer: webServerApi,

  // Profile operations (for debugging)
  profile: profileApi,

  // App info operations (for titlebar and About dialog)
  app: appApi,

  // Shell operations (for opening external URLs)
  shell: shellApi,

  // Clipboard operations (for testing and copy functionality)
  clipboard: clipboardApi,

  // Window state operations (for session restoration)
  windowState: windowStateApi,

  // Window operations
  window: windowApi,

  // Storage inspector operations
  inspector: inspectorApi,

  // Image operations
  image: imageApi,

  // Thumbnail operations
  thumbnail: thumbnailApi,

  // Comment operations
  comment: commentApi,

  // Mention operations
  mention: mentionApi,
});

// Set window.__NOTECOVE_PROFILE__ for DevTools inspection
void ipcRenderer.invoke('profile:getInfo').then((info: unknown) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  (window as any).__NOTECOVE_PROFILE__ = info;
});
