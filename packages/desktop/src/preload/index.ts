/**
 * Electron Preload Script
 *
 * This script runs in a sandboxed context with access to both Node.js APIs
 * and the renderer's DOM. It exposes safe IPC methods to the renderer.
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { NoteMetadata, SyncProgress } from '../main/ipc/types';

// Expose IPC API to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,

  // Note operations
  note: {
    load: (noteId: string): Promise<void> =>
      ipcRenderer.invoke('note:load', noteId) as Promise<void>,
    unload: (noteId: string): Promise<void> =>
      ipcRenderer.invoke('note:unload', noteId) as Promise<void>,
    applyUpdate: (noteId: string, update: Uint8Array): Promise<void> =>
      ipcRenderer.invoke('note:applyUpdate', noteId, update) as Promise<void>,
    create: (sdId: string, folderId: string, initialContent: string): Promise<string> =>
      ipcRenderer.invoke('note:create', sdId, folderId, initialContent) as Promise<string>,
    delete: (noteId: string): Promise<void> =>
      ipcRenderer.invoke('note:delete', noteId) as Promise<void>,
    move: (noteId: string, newFolderId: string): Promise<void> =>
      ipcRenderer.invoke('note:move', noteId, newFolderId) as Promise<void>,
    getMetadata: (noteId: string): Promise<NoteMetadata> =>
      ipcRenderer.invoke('note:getMetadata', noteId) as Promise<NoteMetadata>,

    // Event listeners
    onUpdated: (callback: (noteId: string, update: Uint8Array) => void): (() => void) => {
      ipcRenderer.on('note:updated', (_event, noteId: string, update: Uint8Array) => {
        callback(noteId, update);
      });
      return () => {
        ipcRenderer.removeAllListeners('note:updated');
      };
    },
    onDeleted: (callback: (noteId: string) => void): (() => void) => {
      ipcRenderer.on('note:deleted', (_event, noteId: string) => {
        callback(noteId);
      });
      return () => {
        ipcRenderer.removeAllListeners('note:deleted');
      };
    },
  },

  // Folder operations
  folder: {
    create: (sdId: string, parentId: string, name: string): Promise<string> =>
      ipcRenderer.invoke('folder:create', sdId, parentId, name) as Promise<string>,
    delete: (folderId: string): Promise<void> =>
      ipcRenderer.invoke('folder:delete', folderId) as Promise<void>,

    // Event listeners
    onUpdated: (callback: (folderId: string) => void): (() => void) => {
      ipcRenderer.on('folder:updated', (_event, folderId: string) => {
        callback(folderId);
      });
      return () => {
        ipcRenderer.removeAllListeners('folder:updated');
      };
    },
  },

  // Sync operations
  sync: {
    onProgress: (callback: (sdId: string, progress: SyncProgress) => void): (() => void) => {
      ipcRenderer.on('sync:progress', (_event, sdId: string, progress: SyncProgress) => {
        callback(sdId, progress);
      });
      return () => {
        ipcRenderer.removeAllListeners('sync:progress');
      };
    },
  },

  // App state operations
  appState: {
    get: (key: string): Promise<string | null> =>
      ipcRenderer.invoke('appState:get', key) as Promise<string | null>,
    set: (key: string, value: string): Promise<void> =>
      ipcRenderer.invoke('appState:set', key, value) as Promise<void>,
  },
});
