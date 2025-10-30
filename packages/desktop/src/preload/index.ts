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
    getState: (noteId: string): Promise<Uint8Array> =>
      ipcRenderer.invoke('note:getState', noteId) as Promise<Uint8Array>,
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
    updateTitle: (noteId: string, title: string, contentText?: string): Promise<void> =>
      ipcRenderer.invoke('note:updateTitle', noteId, title, contentText) as Promise<void>,
    list: (
      sdId: string,
      folderId?: string | null
    ): Promise<
      {
        id: string;
        title: string;
        sdId: string;
        folderId: string | null;
        created: number;
        modified: number;
        deleted: boolean;
        contentPreview: string;
        contentText: string;
      }[]
    > =>
      ipcRenderer.invoke('note:list', sdId, folderId) as Promise<
        {
          id: string;
          title: string;
          sdId: string;
          folderId: string | null;
          created: number;
          modified: number;
          deleted: boolean;
          contentPreview: string;
          contentText: string;
        }[]
      >,

    search: (
      query: string,
      limit?: number
    ): Promise<
      {
        noteId: string;
        title: string;
        snippet: string;
        rank: number;
      }[]
    > =>
      ipcRenderer.invoke('note:search', query, limit) as Promise<
        {
          noteId: string;
          title: string;
          snippet: string;
          rank: number;
        }[]
      >,

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
    onCreated: (
      callback: (data: { sdId: string; noteId: string; folderId: string | null }) => void
    ): (() => void) => {
      ipcRenderer.on(
        'note:created',
        (_event, data: { sdId: string; noteId: string; folderId: string | null }) => {
          callback(data);
        }
      );
      return () => {
        ipcRenderer.removeAllListeners('note:created');
      };
    },
    onExternalUpdate: (
      callback: (data: { operation: string; noteIds: string[] }) => void
    ): (() => void) => {
      ipcRenderer.on(
        'note:external-update',
        (_event, data: { operation: string; noteIds: string[] }) => {
          callback(data);
        }
      );
      return () => {
        ipcRenderer.removeAllListeners('note:external-update');
      };
    },
    onTitleUpdated: (callback: (data: { noteId: string; title: string }) => void): (() => void) => {
      ipcRenderer.on('note:title-updated', (_event, data: { noteId: string; title: string }) => {
        callback(data);
      });
      return () => {
        ipcRenderer.removeAllListeners('note:title-updated');
      };
    },
    onMoved: (
      callback: (data: { noteId: string; oldFolderId: string | null; newFolderId: string }) => void
    ): (() => void) => {
      ipcRenderer.on(
        'note:moved',
        (_event, data: { noteId: string; oldFolderId: string | null; newFolderId: string }) => {
          callback(data);
        }
      );
      return () => {
        ipcRenderer.removeAllListeners('note:moved');
      };
    },
  },

  // Folder operations
  folder: {
    list: (
      sdId: string
    ): Promise<
      {
        id: string;
        name: string;
        parentId: string | null;
        sdId: string;
        order: number;
        deleted: boolean;
      }[]
    > =>
      ipcRenderer.invoke('folder:list', sdId) as Promise<
        {
          id: string;
          name: string;
          parentId: string | null;
          sdId: string;
          order: number;
          deleted: boolean;
        }[]
      >,
    get: (
      sdId: string,
      folderId: string
    ): Promise<{
      id: string;
      name: string;
      parentId: string | null;
      sdId: string;
      order: number;
      deleted: boolean;
    } | null> =>
      ipcRenderer.invoke('folder:get', sdId, folderId) as Promise<{
        id: string;
        name: string;
        parentId: string | null;
        sdId: string;
        order: number;
        deleted: boolean;
      } | null>,
    create: (sdId: string, parentId: string | null, name: string): Promise<string> =>
      ipcRenderer.invoke('folder:create', sdId, parentId, name) as Promise<string>,
    rename: (sdId: string, folderId: string, newName: string): Promise<void> =>
      ipcRenderer.invoke('folder:rename', sdId, folderId, newName) as Promise<void>,
    delete: (sdId: string, folderId: string): Promise<void> =>
      ipcRenderer.invoke('folder:delete', sdId, folderId) as Promise<void>,
    move: (sdId: string, folderId: string, newParentId: string | null): Promise<void> =>
      ipcRenderer.invoke('folder:move', sdId, folderId, newParentId) as Promise<void>,

    // Event listeners
    onUpdated: (
      callback: (data: { sdId: string; operation: string; folderId: string }) => void
    ): (() => void) => {
      ipcRenderer.on(
        'folder:updated',
        (_event, data: { sdId: string; operation: string; folderId: string }) => {
          callback(data);
        }
      );
      return () => {
        ipcRenderer.removeAllListeners('folder:updated');
      };
    },
  },

  // Storage Directory operations
  sd: {
    list: (): Promise<
      {
        id: string;
        name: string;
        path: string;
        created: number;
        isActive: boolean;
      }[]
    > =>
      ipcRenderer.invoke('sd:list') as Promise<
        {
          id: string;
          name: string;
          path: string;
          created: number;
          isActive: boolean;
        }[]
      >,
    create: (name: string, path: string): Promise<string> =>
      ipcRenderer.invoke('sd:create', name, path) as Promise<string>,
    setActive: (sdId: string): Promise<void> =>
      ipcRenderer.invoke('sd:setActive', sdId) as Promise<void>,
    getActive: (): Promise<string | null> =>
      ipcRenderer.invoke('sd:getActive') as Promise<string | null>,

    // Event listeners
    onUpdated: (callback: (data: { operation: string; sdId: string }) => void): (() => void) => {
      ipcRenderer.on('sd:updated', (_event, data: { operation: string; sdId: string }) => {
        callback(data);
      });
      return () => {
        ipcRenderer.removeAllListeners('sd:updated');
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

  // Testing operations (only available if main process registered handler)
  testing: {
    createWindow: (): Promise<void> => ipcRenderer.invoke('testing:createWindow') as Promise<void>,
  },
});
