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
import { syncApi, recoveryApi, pollingApi } from './api/sync-api';
import {
  appStateApi,
  configApi,
  telemetryApi,
  shellApi,
  clipboardApi,
  profileApi,
  appApi,
} from './api/app-api';
import { backupApi, diagnosticsApi } from './api/backup-api';
import { windowStateApi, windowApi, menuApi, shutdownApi } from './api/window-api';
import { imageApi, thumbnailApi } from './api/image-api';
import { commentApi, mentionApi, userApi } from './api/comment-api';
import {
  toolsApi,
  exportApi,
  importApi,
  testingApi,
  webServerApi,
  inspectorApi,
  featureFlagsApi,
} from './api/misc-api';
import { themeApi } from './api/theme-api';
import { oembedApi } from './api/oembed-api';

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

  // Polling group operations
  polling: pollingApi,

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

  // User operations
  user: userApi,

  // Theme operations
  theme: themeApi,

  // Feature flags operations
  featureFlags: featureFlagsApi,

  // oEmbed link unfurling operations
  oembed: oembedApi,
});

// Set window.__NOTECOVE_PROFILE__ for DevTools inspection
void ipcRenderer.invoke('profile:getInfo').then((info: unknown) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  (window as any).__NOTECOVE_PROFILE__ = info;
});

// Set window.__NOTECOVE_OEMBED_DEBUG__ for oEmbed debugging from console
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
(window as any).__NOTECOVE_OEMBED_DEBUG__ = {
  // Test a URL
  async unfurl(url: string) {
    console.log('[oEmbed Debug] Unfurling:', url);
    const result = await oembedApi.unfurl(url);
    console.log('[oEmbed Debug] Result:', result);
    return result;
  },

  // Get cache stats
  async stats() {
    const stats = await oembedApi.getCacheStats();
    console.table(stats);
    return stats;
  },

  // List favicons
  async favicons() {
    const favicons = await oembedApi.debug.listFavicons();
    console.log('[oEmbed Debug] Favicons:', favicons.length);
    console.table(
      favicons.map((f) => ({
        domain: f.domain,
        size: f.dataUrl.length,
        fetched: new Date(f.fetchedAt).toLocaleString(),
      }))
    );
    return favicons;
  },

  // List thumbnails
  async thumbnails() {
    const thumbnails = await oembedApi.debug.listThumbnails();
    console.log('[oEmbed Debug] Thumbnails:', thumbnails.length);
    console.table(
      thumbnails.map((t) => ({
        url: t.url.substring(0, 60) + '...',
        sizeBytes: t.sizeBytes,
        fetched: new Date(t.fetchedAt).toLocaleString(),
      }))
    );
    return thumbnails;
  },

  // List fetch cache
  async fetchCache() {
    const cache = await oembedApi.debug.listFetchCache();
    console.log('[oEmbed Debug] Fetch cache entries:', cache.length);
    console.table(
      cache.map((c) => {
        let type = 'unknown';
        try {
          const parsed = JSON.parse(c.rawJson) as { type?: string };
          type = parsed.type ?? 'unknown';
        } catch {
          // Ignore parse errors
        }
        return {
          url: c.url.substring(0, 60) + '...',
          type,
          fetched: new Date(c.fetchedAt).toLocaleString(),
        };
      })
    );
    return cache;
  },

  // Clear all caches
  async clearAll() {
    console.log('[oEmbed Debug] Clearing all caches...');
    await oembedApi.clearCache();
    await oembedApi.debug.clearAllFavicons();
    await oembedApi.debug.clearAllThumbnails();
    console.log('[oEmbed Debug] All caches cleared');
  },

  // Help text
  help() {
    console.log(`
oEmbed Debug Helper - Available commands:

  __NOTECOVE_OEMBED_DEBUG__.unfurl(url)     - Test unfurling a URL
  __NOTECOVE_OEMBED_DEBUG__.stats()         - Show cache statistics
  __NOTECOVE_OEMBED_DEBUG__.favicons()      - List all cached favicons
  __NOTECOVE_OEMBED_DEBUG__.thumbnails()    - List all cached thumbnails
  __NOTECOVE_OEMBED_DEBUG__.fetchCache()    - List fetch cache entries
  __NOTECOVE_OEMBED_DEBUG__.clearAll()      - Clear all caches
`);
  },
};
