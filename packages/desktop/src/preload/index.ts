/**
 * Electron Preload Script
 *
 * This script runs in a sandboxed context with access to both Node.js APIs
 * and the renderer's DOM. It exposes safe IPC methods to the renderer.
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { NoteMetadata, SyncProgress } from '../main/ipc/types';
import type { NoteCache } from '@notecove/shared';

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
    restore: (noteId: string): Promise<void> =>
      ipcRenderer.invoke('note:restore', noteId) as Promise<void>,
    permanentDelete: (noteId: string): Promise<void> =>
      ipcRenderer.invoke('note:permanentDelete', noteId) as Promise<void>,
    duplicate: (noteId: string): Promise<string> =>
      ipcRenderer.invoke('note:duplicate', noteId) as Promise<string>,
    togglePin: (noteId: string): Promise<void> =>
      ipcRenderer.invoke('note:togglePin', noteId) as Promise<void>,
    move: (noteId: string, newFolderId: string): Promise<void> =>
      ipcRenderer.invoke('note:move', noteId, newFolderId) as Promise<void>,
    moveToSD: (
      noteId: string,
      sourceSdId: string,
      targetSdId: string,
      targetFolderId: string | null,
      conflictResolution: 'replace' | 'keepBoth' | null
    ): Promise<void> =>
      ipcRenderer.invoke(
        'note:moveToSD',
        noteId,
        sourceSdId,
        targetSdId,
        targetFolderId,
        conflictResolution
      ) as Promise<void>,
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
    getCountForFolder: (sdId: string, folderId: string | null): Promise<number> =>
      ipcRenderer.invoke('note:getCountForFolder', sdId, folderId) as Promise<number>,
    getAllNotesCount: (sdId: string): Promise<number> =>
      ipcRenderer.invoke('note:getAllNotesCount', sdId) as Promise<number>,
    getDeletedNoteCount: (sdId: string): Promise<number> =>
      ipcRenderer.invoke('note:getDeletedNoteCount', sdId) as Promise<number>,
    createSnapshot: (
      noteId: string
    ): Promise<{ success: boolean; filename?: string; error?: string }> =>
      ipcRenderer.invoke('note:createSnapshot', noteId) as Promise<{
        success: boolean;
        filename?: string;
        error?: string;
      }>,
    checkExistsInSD: (
      noteId: string,
      targetSdId: string
    ): Promise<{ exists: boolean; isDeleted: boolean }> =>
      ipcRenderer.invoke('note:checkExistsInSD', noteId, targetSdId) as Promise<{
        exists: boolean;
        isDeleted: boolean;
      }>,

    // Event listeners
    onUpdated: (callback: (noteId: string, update: Uint8Array) => void): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        noteId: string,
        update: Uint8Array
      ): void => {
        callback(noteId, update);
      };
      ipcRenderer.on('note:updated', listener);
      return () => {
        ipcRenderer.removeListener('note:updated', listener);
      };
    },
    onDeleted: (callback: (noteId: string) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, noteId: string): void => {
        callback(noteId);
      };
      ipcRenderer.on('note:deleted', listener);
      return () => {
        ipcRenderer.removeListener('note:deleted', listener);
      };
    },
    onRestored: (callback: (noteId: string) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, noteId: string): void => {
        callback(noteId);
      };
      ipcRenderer.on('note:restored', listener);
      return () => {
        ipcRenderer.removeListener('note:restored', listener);
      };
    },
    onPermanentDeleted: (callback: (noteId: string) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, noteId: string): void => {
        callback(noteId);
      };
      ipcRenderer.on('note:permanentDeleted', listener);
      return () => {
        ipcRenderer.removeListener('note:permanentDeleted', listener);
      };
    },
    onPinned: (callback: (data: { noteId: string; pinned: boolean }) => void): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: { noteId: string; pinned: boolean }
      ): void => {
        callback(data);
      };
      ipcRenderer.on('note:pinned', listener);
      return () => {
        ipcRenderer.removeListener('note:pinned', listener);
      };
    },
    onCreated: (
      callback: (data: { sdId: string; noteId: string; folderId: string | null }) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: { sdId: string; noteId: string; folderId: string | null }
      ): void => {
        callback(data);
      };
      ipcRenderer.on('note:created', listener);
      return () => {
        ipcRenderer.removeListener('note:created', listener);
      };
    },
    onExternalUpdate: (
      callback: (data: { operation: string; noteIds: string[] }) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: { operation: string; noteIds: string[] }
      ): void => {
        callback(data);
      };
      ipcRenderer.on('note:external-update', listener);
      return () => {
        ipcRenderer.removeListener('note:external-update', listener);
      };
    },
    onTitleUpdated: (callback: (data: { noteId: string; title: string }) => void): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: { noteId: string; title: string }
      ): void => {
        callback(data);
      };
      ipcRenderer.on('note:title-updated', listener);
      return () => {
        ipcRenderer.removeListener('note:title-updated', listener);
      };
    },
    onMoved: (
      callback: (data: { noteId: string; oldFolderId: string | null; newFolderId: string }) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: { noteId: string; oldFolderId: string | null; newFolderId: string }
      ): void => {
        callback(data);
      };
      ipcRenderer.on('note:moved', listener);
      return () => {
        ipcRenderer.removeListener('note:moved', listener);
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
    listAll: (): Promise<
      {
        sdId: string;
        sdName: string;
        folders: {
          id: string;
          name: string;
          parentId: string | null;
          sdId: string;
          order: number;
          deleted: boolean;
        }[];
      }[]
    > =>
      ipcRenderer.invoke('folder:listAll') as Promise<
        {
          sdId: string;
          sdName: string;
          folders: {
            id: string;
            name: string;
            parentId: string | null;
            sdId: string;
            order: number;
            deleted: boolean;
          }[];
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
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: { sdId: string; operation: string; folderId: string }
      ): void => {
        callback(data);
      };
      ipcRenderer.on('folder:updated', listener);
      return () => {
        ipcRenderer.removeListener('folder:updated', listener);
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
    delete: (sdId: string): Promise<void> => ipcRenderer.invoke('sd:delete', sdId) as Promise<void>,
    selectPath: (defaultPath?: string): Promise<string | null> =>
      ipcRenderer.invoke('sd:selectPath', defaultPath) as Promise<string | null>,
    getCloudStoragePaths: (): Promise<Record<string, string>> =>
      ipcRenderer.invoke('sd:getCloudStoragePaths') as Promise<Record<string, string>>,

    // Event listeners
    onOpenSettings: (callback: () => void): (() => void) => {
      const listener = (): void => {
        callback();
      };
      ipcRenderer.on('settings:open', listener);
      return () => {
        ipcRenderer.removeListener('settings:open', listener);
      };
    },
    onUpdated: (callback: (data: { operation: string; sdId: string }) => void): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: { operation: string; sdId: string }
      ): void => {
        callback(data);
      };
      ipcRenderer.on('sd:updated', listener);
      return () => {
        ipcRenderer.removeListener('sd:updated', listener);
      };
    },
  },

  // Sync operations
  sync: {
    onProgress: (callback: (sdId: string, progress: SyncProgress) => void): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        sdId: string,
        progress: SyncProgress
      ): void => {
        callback(sdId, progress);
      };
      ipcRenderer.on('sync:progress', listener);
      return () => {
        ipcRenderer.removeListener('sync:progress', listener);
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

  // Config operations
  config: {
    getDatabasePath: (): Promise<string> =>
      ipcRenderer.invoke('config:getDatabasePath') as Promise<string>,
    setDatabasePath: (path: string): Promise<void> =>
      ipcRenderer.invoke('config:setDatabasePath', path) as Promise<void>,
  },

  // Telemetry operations
  telemetry: {
    getSettings: (): Promise<{ remoteMetricsEnabled: boolean; datadogApiKey?: string }> =>
      ipcRenderer.invoke('telemetry:getSettings') as Promise<{
        remoteMetricsEnabled: boolean;
        datadogApiKey?: string;
      }>,
    updateSettings: (settings: {
      remoteMetricsEnabled: boolean;
      datadogApiKey?: string;
    }): Promise<void> => ipcRenderer.invoke('telemetry:updateSettings', settings) as Promise<void>,
  },

  // Menu event listeners
  menu: {
    onNewNote: (callback: () => void): (() => void) => {
      const listener = (): void => {
        callback();
      };
      ipcRenderer.on('menu:new-note', listener);
      return () => {
        ipcRenderer.removeListener('menu:new-note', listener);
      };
    },
    onNewFolder: (callback: () => void): (() => void) => {
      const listener = (): void => {
        callback();
      };
      ipcRenderer.on('menu:new-folder', listener);
      return () => {
        ipcRenderer.removeListener('menu:new-folder', listener);
      };
    },
    onFind: (callback: () => void): (() => void) => {
      const listener = (): void => {
        callback();
      };
      ipcRenderer.on('menu:find', listener);
      return () => {
        ipcRenderer.removeListener('menu:find', listener);
      };
    },
    onFindInNote: (callback: () => void): (() => void) => {
      const listener = (): void => {
        callback();
      };
      ipcRenderer.on('menu:find-in-note', listener);
      return () => {
        ipcRenderer.removeListener('menu:find-in-note', listener);
      };
    },
    onToggleDarkMode: (callback: () => void): (() => void) => {
      const listener = (): void => {
        callback();
      };
      ipcRenderer.on('menu:toggle-dark-mode', listener);
      return () => {
        ipcRenderer.removeListener('menu:toggle-dark-mode', listener);
      };
    },
    onToggleFolderPanel: (callback: () => void): (() => void) => {
      const listener = (): void => {
        callback();
      };
      ipcRenderer.on('menu:toggle-folder-panel', listener);
      return () => {
        ipcRenderer.removeListener('menu:toggle-folder-panel', listener);
      };
    },
    onToggleTagsPanel: (callback: () => void): (() => void) => {
      const listener = (): void => {
        callback();
      };
      ipcRenderer.on('menu:toggle-tags-panel', listener);
      return () => {
        ipcRenderer.removeListener('menu:toggle-tags-panel', listener);
      };
    },
    onCreateSnapshot: (callback: () => void): (() => void) => {
      const listener = (): void => {
        callback();
      };
      ipcRenderer.on('menu:createSnapshot', listener);
      return () => {
        ipcRenderer.removeListener('menu:createSnapshot', listener);
      };
    },
    onAbout: (callback: () => void): (() => void) => {
      const listener = (): void => {
        callback();
      };
      ipcRenderer.on('menu:about', listener);
      return () => {
        ipcRenderer.removeListener('menu:about', listener);
      };
    },
  },

  // Testing operations (only available if main process registered handler)
  testing: {
    createWindow: (): Promise<void> => ipcRenderer.invoke('testing:createWindow') as Promise<void>,
    // Test-only: Set note timestamp (only available in NODE_ENV=test)
    setNoteTimestamp: (noteId: string, timestamp: number): Promise<void> =>
      ipcRenderer.invoke('test:setNoteTimestamp', noteId, timestamp) as Promise<void>,
    // Test-only: Tag database queries (only available in NODE_ENV=test)
    getAllTags: (): Promise<{ id: string; name: string }[]> =>
      ipcRenderer.invoke('test:getAllTags') as Promise<{ id: string; name: string }[]>,
    getTagsForNote: (noteId: string): Promise<{ id: string; name: string }[]> =>
      ipcRenderer.invoke('test:getTagsForNote', noteId) as Promise<{ id: string; name: string }[]>,
    getNoteById: (noteId: string): Promise<NoteCache | null> =>
      ipcRenderer.invoke('test:getNoteById', noteId) as Promise<NoteCache | null>,
  },
});
