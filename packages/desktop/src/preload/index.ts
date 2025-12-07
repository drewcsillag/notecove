/**
 * Electron Preload Script
 *
 * This script runs in a sandboxed context with access to both Node.js APIs
 * and the renderer's DOM. It exposes safe IPC methods to the renderer.
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { NoteMetadata, SyncProgress, SyncStatus, StaleSyncEntry } from '../main/ipc/types';
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
    getState: (noteId: string, stateVector?: Uint8Array): Promise<Uint8Array> =>
      ipcRenderer.invoke('note:getState', noteId, stateVector) as Promise<Uint8Array>,
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
    getInfo: (noteId: string) =>
      ipcRenderer.invoke('note:getInfo', noteId) as Promise<{
        id: string;
        title: string;
        sdId: string;
        sdName: string;
        sdPath: string;
        folderId: string | null;
        folderName: string | null;
        folderPath: string | null;
        created: number;
        modified: number;
        tags: string[];
        characterCount: number;
        wordCount: number;
        paragraphCount: number;
        vectorClock: Record<string, number>;
        documentHash: string;
        crdtUpdateCount: number;
        noteDirPath: string;
        totalFileSize: number;
        snapshotCount: number;
        packCount: number;
        deleted: boolean;
        pinned: boolean;
        contentPreview: string;
      } | null>,
    reloadFromCRDTLogs: (noteId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('note:reloadFromCRDTLogs', noteId) as Promise<{
        success: boolean;
        error?: string;
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

  // History operations
  history: {
    getTimeline: (noteId: string) => ipcRenderer.invoke('history:getTimeline', noteId),
    getStats: (noteId: string) => ipcRenderer.invoke('history:getStats', noteId),
    reconstructAt: (noteId: string, point: { timestamp: number; updateIndex?: number }) =>
      ipcRenderer.invoke('history:reconstructAt', noteId, point),
    getSessionPreview: (noteId: string, sessionId: string) =>
      ipcRenderer.invoke('history:getSessionPreview', noteId, sessionId),
  },

  // Tag operations
  tag: {
    getAll: (): Promise<{ id: string; name: string; count: number }[]> =>
      ipcRenderer.invoke('tag:getAll') as Promise<{ id: string; name: string; count: number }[]>,
  },

  // Link operations
  link: {
    getBacklinks: (noteId: string): Promise<NoteCache[]> =>
      ipcRenderer.invoke('link:getBacklinks', noteId) as Promise<NoteCache[]>,
    searchNotesForAutocomplete: (
      query: string
    ): Promise<
      {
        id: string;
        title: string;
        sdId: string;
        folderId: string | null;
        folderPath: string;
        created: number;
        modified: number;
      }[]
    > =>
      ipcRenderer.invoke('link:searchNotesForAutocomplete', query) as Promise<
        {
          id: string;
          title: string;
          sdId: string;
          folderId: string | null;
          folderPath: string;
          created: number;
          modified: number;
        }[]
      >,
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
    reorder: (sdId: string, folderId: string, newIndex: number): Promise<void> =>
      ipcRenderer.invoke('folder:reorder', sdId, folderId, newIndex) as Promise<void>,

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

    // Emit folder selection event (for clearing search when folder is clicked)
    emitSelected: (folderId: string): Promise<void> =>
      ipcRenderer.invoke('folder:emitSelected', folderId) as Promise<void>,

    // Listen for folder selection events
    onSelected: (callback: (folderId: string) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, folderId: string): void => {
        callback(folderId);
      };
      ipcRenderer.on('folder:selected', listener);
      return () => {
        ipcRenderer.removeListener('folder:selected', listener);
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
    rename: (sdId: string, newName: string): Promise<void> =>
      ipcRenderer.invoke('sd:rename', sdId, newName) as Promise<void>,
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
    onInitProgress: (
      callback: (data: { sdId: string; step: number; total: number; message: string }) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: { sdId: string; step: number; total: number; message: string }
      ): void => {
        callback(data);
      };
      ipcRenderer.on('sd:init-progress', listener);
      return () => {
        ipcRenderer.removeListener('sd:init-progress', listener);
      };
    },
    onInitComplete: (callback: (data: { sdId: string }) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: { sdId: string }): void => {
        callback(data);
      };
      ipcRenderer.on('sd:init-complete', listener);
      return () => {
        ipcRenderer.removeListener('sd:init-complete', listener);
      };
    },
    onInitError: (callback: (data: { sdId: string; error: string }) => void): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: { sdId: string; error: string }
      ): void => {
        callback(data);
      };
      ipcRenderer.on('sd:init-error', listener);
      return () => {
        ipcRenderer.removeListener('sd:init-error', listener);
      };
    },
  },

  // Sync operations
  sync: {
    openWindow: (): Promise<void> => ipcRenderer.invoke('sync:openWindow') as Promise<void>,
    getStatus: (): Promise<SyncStatus> =>
      ipcRenderer.invoke('sync:getStatus') as Promise<SyncStatus>,
    getStaleSyncs: (): Promise<StaleSyncEntry[]> =>
      ipcRenderer.invoke('sync:getStaleSyncs') as Promise<StaleSyncEntry[]>,
    skipStaleEntry: (
      sdId: string,
      noteId: string,
      sourceInstanceId: string
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('sync:skipStaleEntry', sdId, noteId, sourceInstanceId) as Promise<{
        success: boolean;
        error?: string;
      }>,
    retryStaleEntry: (
      sdId: string,
      noteId: string,
      sourceInstanceId: string
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('sync:retryStaleEntry', sdId, noteId, sourceInstanceId) as Promise<{
        success: boolean;
        error?: string;
      }>,
    exportDiagnostics: (): Promise<{ success: boolean; filePath?: string; error?: string }> =>
      ipcRenderer.invoke('sync:exportDiagnostics') as Promise<{
        success: boolean;
        filePath?: string;
        error?: string;
      }>,
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
    onStatusChanged: (callback: (status: SyncStatus) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, status: SyncStatus): void => {
        callback(status);
      };
      ipcRenderer.on('sync:status-changed', listener);
      return () => {
        ipcRenderer.removeListener('sync:status-changed', listener);
      };
    },
    onStaleEntriesChanged: (callback: (entries: StaleSyncEntry[]) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, entries: StaleSyncEntry[]): void => {
        callback(entries);
      };
      ipcRenderer.on('sync:stale-entries-changed', listener);
      return () => {
        ipcRenderer.removeListener('sync:stale-entries-changed', listener);
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

  // Shutdown progress operations
  shutdown: {
    onProgress: (callback: (data: { current: number; total: number }) => void): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: { current: number; total: number }
      ): void => {
        callback(data);
      };
      ipcRenderer.on('shutdown:progress', listener);
      return () => {
        ipcRenderer.removeListener('shutdown:progress', listener);
      };
    },
    onComplete: (callback: () => void): (() => void) => {
      const listener = (): void => {
        callback();
      };
      ipcRenderer.on('shutdown:complete', listener);
      return () => {
        ipcRenderer.removeListener('shutdown:complete', listener);
      };
    },
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
    getSettings: (): Promise<{
      consoleMetricsEnabled: boolean;
      remoteMetricsEnabled: boolean;
      datadogApiKey?: string;
    }> =>
      ipcRenderer.invoke('telemetry:getSettings') as Promise<{
        consoleMetricsEnabled: boolean;
        remoteMetricsEnabled: boolean;
        datadogApiKey?: string;
      }>,
    updateSettings: (settings: {
      consoleMetricsEnabled?: boolean;
      remoteMetricsEnabled?: boolean;
      datadogApiKey?: string;
    }): Promise<void> => ipcRenderer.invoke('telemetry:updateSettings', settings) as Promise<void>,
  },

  // Recovery operations
  recovery: {
    getStaleMoves: (): Promise<
      {
        id: string;
        noteId: string;
        sourceSdUuid: string;
        targetSdUuid: string;
        targetFolderId: string | null;
        state: string;
        initiatedBy: string;
        initiatedAt: number;
        lastModified: number;
        sourceSdPath: string;
        targetSdPath: string;
        error: string | null;
      }[]
    > =>
      ipcRenderer.invoke('recovery:getStaleMoves') as Promise<
        {
          id: string;
          noteId: string;
          sourceSdUuid: string;
          targetSdUuid: string;
          targetFolderId: string | null;
          state: string;
          initiatedBy: string;
          initiatedAt: number;
          lastModified: number;
          sourceSdPath: string;
          targetSdPath: string;
          error: string | null;
        }[]
      >,
    takeOverMove: (moveId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('recovery:takeOverMove', moveId) as Promise<{
        success: boolean;
        error?: string;
      }>,
    cancelMove: (moveId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('recovery:cancelMove', moveId) as Promise<{
        success: boolean;
        error?: string;
      }>,
  },

  // Diagnostics operations
  diagnostics: {
    getDuplicateNotes: (): Promise<
      {
        noteId: string;
        noteTitle: string;
        instances: {
          sdId: number;
          sdName: string;
          sdPath: string;
          modifiedAt: string;
          size: number;
          blockCount: number;
          preview: string;
        }[];
      }[]
    > =>
      ipcRenderer.invoke('diagnostics:getDuplicateNotes') as Promise<
        {
          noteId: string;
          noteTitle: string;
          instances: {
            sdId: number;
            sdName: string;
            sdPath: string;
            modifiedAt: string;
            size: number;
            blockCount: number;
            preview: string;
          }[];
        }[]
      >,
    getOrphanedCRDTFiles: (): Promise<
      {
        noteId: string;
        sdId: number;
        sdName: string;
        sdPath: string;
        filePath: string;
        title: string;
        preview: string;
        modifiedAt: string;
        size: number;
        blockCount: number;
      }[]
    > =>
      ipcRenderer.invoke('diagnostics:getOrphanedCRDTFiles') as Promise<
        {
          noteId: string;
          sdId: number;
          sdName: string;
          sdPath: string;
          filePath: string;
          title: string;
          preview: string;
          modifiedAt: string;
          size: number;
          blockCount: number;
        }[]
      >,
    getMissingCRDTFiles: (): Promise<
      {
        noteId: string;
        noteTitle: string;
        sdId: number;
        sdName: string;
        sdPath: string;
        expectedPath: string;
        lastModified: string;
      }[]
    > =>
      ipcRenderer.invoke('diagnostics:getMissingCRDTFiles') as Promise<
        {
          noteId: string;
          noteTitle: string;
          sdId: number;
          sdName: string;
          sdPath: string;
          expectedPath: string;
          lastModified: string;
        }[]
      >,
    getStaleMigrationLocks: (): Promise<
      {
        sdId: number;
        sdName: string;
        sdPath: string;
        lockPath: string;
        ageMinutes: number;
        createdAt: string;
      }[]
    > =>
      ipcRenderer.invoke('diagnostics:getStaleMigrationLocks') as Promise<
        {
          sdId: number;
          sdName: string;
          sdPath: string;
          lockPath: string;
          ageMinutes: number;
          createdAt: string;
        }[]
      >,
    getOrphanedActivityLogs: (): Promise<
      {
        instanceId: string;
        sdId: number;
        sdName: string;
        sdPath: string;
        logPath: string;
        lastSeen: string;
        daysSinceLastSeen: number;
        sizeBytes: number;
      }[]
    > =>
      ipcRenderer.invoke('diagnostics:getOrphanedActivityLogs') as Promise<
        {
          instanceId: string;
          sdId: number;
          sdName: string;
          sdPath: string;
          logPath: string;
          lastSeen: string;
          daysSinceLastSeen: number;
          sizeBytes: number;
        }[]
      >,
    removeStaleMigrationLock: (sdId: number): Promise<void> =>
      ipcRenderer.invoke('diagnostics:removeStaleMigrationLock', sdId) as Promise<void>,
    cleanupOrphanedActivityLog: (sdId: number, instanceId: string): Promise<void> =>
      ipcRenderer.invoke(
        'diagnostics:cleanupOrphanedActivityLog',
        sdId,
        instanceId
      ) as Promise<void>,
    importOrphanedCRDT: (noteId: string, sdId: number): Promise<void> =>
      ipcRenderer.invoke('diagnostics:importOrphanedCRDT', noteId, sdId) as Promise<void>,
    deleteMissingCRDTEntry: (noteId: string, sdId: number): Promise<void> =>
      ipcRenderer.invoke('diagnostics:deleteMissingCRDTEntry', noteId, sdId) as Promise<void>,
    deleteDuplicateNote: (noteId: string, sdId: number): Promise<void> =>
      ipcRenderer.invoke('diagnostics:deleteDuplicateNote', noteId, sdId) as Promise<void>,
  },

  // Backup and restore operations
  backup: {
    createPreOperationSnapshot: (
      sdId: string,
      noteIds: string[],
      description: string
    ): Promise<{
      backupId: string;
      sdUuid: string;
      sdName: string;
      timestamp: number;
      noteCount: number;
      folderCount: number;
      sizeBytes: number;
      type: 'manual' | 'pre-operation';
      isPacked: boolean;
      description?: string;
      backupPath: string;
    }> =>
      ipcRenderer.invoke(
        'backup:createPreOperationSnapshot',
        sdId,
        noteIds,
        description
      ) as Promise<{
        backupId: string;
        sdUuid: string;
        sdName: string;
        timestamp: number;
        noteCount: number;
        folderCount: number;
        sizeBytes: number;
        type: 'manual' | 'pre-operation';
        isPacked: boolean;
        description?: string;
        backupPath: string;
      }>,
    createManualBackup: (
      sdId: string,
      packAndSnapshot: boolean,
      description?: string,
      customBackupPath?: string
    ): Promise<{
      backupId: string;
      sdUuid: string;
      sdName: string;
      timestamp: number;
      noteCount: number;
      folderCount: number;
      sizeBytes: number;
      type: 'manual' | 'pre-operation';
      isPacked: boolean;
      description?: string;
      backupPath: string;
    }> =>
      ipcRenderer.invoke(
        'backup:createManualBackup',
        sdId,
        packAndSnapshot,
        description,
        customBackupPath
      ) as Promise<{
        backupId: string;
        sdUuid: string;
        sdName: string;
        timestamp: number;
        noteCount: number;
        folderCount: number;
        sizeBytes: number;
        type: 'manual' | 'pre-operation';
        isPacked: boolean;
        description?: string;
        backupPath: string;
      }>,
    listBackups: (): Promise<
      {
        backupId: string;
        sdUuid: string;
        sdName: string;
        timestamp: number;
        noteCount: number;
        folderCount: number;
        sizeBytes: number;
        type: 'manual' | 'pre-operation';
        isPacked: boolean;
        description?: string;
        backupPath: string;
      }[]
    > =>
      ipcRenderer.invoke('backup:listBackups') as Promise<
        {
          backupId: string;
          sdUuid: string;
          sdName: string;
          timestamp: number;
          noteCount: number;
          folderCount: number;
          sizeBytes: number;
          type: 'manual' | 'pre-operation';
          isPacked: boolean;
          description?: string;
          backupPath: string;
        }[]
      >,
    restoreFromBackup: (
      backupId: string,
      targetPath: string,
      registerAsNew: boolean
    ): Promise<{ sdId: string; sdPath: string }> =>
      ipcRenderer.invoke(
        'backup:restoreFromBackup',
        backupId,
        targetPath,
        registerAsNew
      ) as Promise<{
        sdId: string;
        sdPath: string;
      }>,
    restoreFromCustomPath: (
      backupPath: string,
      targetPath: string,
      registerAsNew: boolean
    ): Promise<{ sdId: string; sdPath: string }> =>
      ipcRenderer.invoke(
        'backup:restoreFromCustomPath',
        backupPath,
        targetPath,
        registerAsNew
      ) as Promise<{
        sdId: string;
        sdPath: string;
      }>,
    deleteBackup: (backupId: string): Promise<void> =>
      ipcRenderer.invoke('backup:deleteBackup', backupId) as Promise<void>,
    cleanupOldSnapshots: (): Promise<number> =>
      ipcRenderer.invoke('backup:cleanupOldSnapshots') as Promise<number>,
    setBackupDirectory: (customPath: string): Promise<void> =>
      ipcRenderer.invoke('backup:setBackupDirectory', customPath) as Promise<void>,
    getBackupDirectory: (): Promise<string> =>
      ipcRenderer.invoke('backup:getBackupDirectory') as Promise<string>,
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
    onViewHistory: (callback: () => void): (() => void) => {
      const listener = (): void => {
        callback();
      };
      ipcRenderer.on('menu:viewHistory', listener);
      return () => {
        ipcRenderer.removeListener('menu:viewHistory', listener);
      };
    },
    onNoteInfo: (callback: () => void): (() => void) => {
      const listener = (): void => {
        callback();
      };
      ipcRenderer.on('menu:noteInfo', listener);
      return () => {
        ipcRenderer.removeListener('menu:noteInfo', listener);
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
    onExportSelectedNotes: (callback: () => void): (() => void) => {
      const listener = (): void => {
        callback();
      };
      ipcRenderer.on('menu:export-selected-notes', listener);
      return () => {
        ipcRenderer.removeListener('menu:export-selected-notes', listener);
      };
    },
    onExportAllNotes: (callback: () => void): (() => void) => {
      const listener = (): void => {
        callback();
      };
      ipcRenderer.on('menu:export-all-notes', listener);
      return () => {
        ipcRenderer.removeListener('menu:export-all-notes', listener);
      };
    },
    onReloadFromCRDTLogs: (callback: () => void): (() => void) => {
      const listener = (): void => {
        callback();
      };
      ipcRenderer.on('menu:reloadFromCRDTLogs', listener);
      return () => {
        ipcRenderer.removeListener('menu:reloadFromCRDTLogs', listener);
      };
    },
    onReindexNotes: (callback: () => void): (() => void) => {
      const listener = (): void => {
        callback();
      };
      ipcRenderer.on('menu:reindexNotes', listener);
      return () => {
        ipcRenderer.removeListener('menu:reindexNotes', listener);
      };
    },
    onSyncStatus: (callback: () => void): (() => void) => {
      const listener = (): void => {
        callback();
      };
      ipcRenderer.on('menu:syncStatus', listener);
      return () => {
        ipcRenderer.removeListener('menu:syncStatus', listener);
      };
    },
  },

  // Tools operations
  tools: {
    reindexNotes: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('tools:reindexNotes') as Promise<{ success: boolean; error?: string }>,
    onReindexProgress: (
      callback: (data: { current: number; total: number }) => void
    ): (() => void) => {
      const listener = (_event: unknown, data: { current: number; total: number }): void => {
        callback(data);
      };
      ipcRenderer.on('tools:reindex-progress', listener);
      return () => {
        ipcRenderer.removeListener('tools:reindex-progress', listener);
      };
    },
    onReindexComplete: (callback: () => void): (() => void) => {
      const listener = (): void => {
        callback();
      };
      ipcRenderer.on('tools:reindex-complete', listener);
      return () => {
        ipcRenderer.removeListener('tools:reindex-complete', listener);
      };
    },
    onReindexError: (callback: (data: { error: string }) => void): (() => void) => {
      const listener = (_event: unknown, data: { error: string }): void => {
        callback(data);
      };
      ipcRenderer.on('tools:reindex-error', listener);
      return () => {
        ipcRenderer.removeListener('tools:reindex-error', listener);
      };
    },
  },

  // Export operations
  export: {
    selectDirectory: (): Promise<string | null> =>
      ipcRenderer.invoke('export:selectDirectory') as Promise<string | null>,
    writeFile: (filePath: string, content: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('export:writeFile', filePath, content) as Promise<{
        success: boolean;
        error?: string;
      }>,
    createDirectory: (dirPath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('export:createDirectory', dirPath) as Promise<{
        success: boolean;
        error?: string;
      }>,
    getNotesForExport: (
      noteIds: string[]
    ): Promise<
      {
        id: string;
        title: string;
        folderId: string | null;
        content: unknown;
        isEmpty: boolean;
      }[]
    > =>
      ipcRenderer.invoke('export:getNotesForExport', noteIds) as Promise<
        {
          id: string;
          title: string;
          folderId: string | null;
          content: unknown;
          isEmpty: boolean;
        }[]
      >,
    showCompletionMessage: (
      exportedCount: number,
      skippedCount: number,
      destinationPath: string,
      errors: string[]
    ): Promise<void> =>
      ipcRenderer.invoke(
        'export:showCompletionMessage',
        exportedCount,
        skippedCount,
        destinationPath,
        errors
      ) as Promise<void>,
  },

  // Testing operations (only available if main process registered handler)
  testing: {
    createWindow: (options?: { noteId?: string; minimal?: boolean }): Promise<void> =>
      ipcRenderer.invoke('testing:createWindow', options) as Promise<void>,
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

    // Test instrumentation: File watcher events
    onFileWatcherEvent: (
      callback: (data: {
        sdId: string;
        filename: string;
        type: string;
        gracePeriodActive: boolean;
      }) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: { sdId: string; filename: string; type: string; gracePeriodActive: boolean }
      ): void => {
        callback(data);
      };
      ipcRenderer.on('test:file-watcher-event', listener);
      return () => {
        ipcRenderer.removeListener('test:file-watcher-event', listener);
      };
    },
    onGracePeriodEnded: (callback: (data: { sdId: string }) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: { sdId: string }): void => {
        callback(data);
      };
      ipcRenderer.on('test:grace-period-ended', listener);
      return () => {
        ipcRenderer.removeListener('test:grace-period-ended', listener);
      };
    },
    onActivitySyncComplete: (
      callback: (data: { sdId: string; noteIds: string[] }) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: { sdId: string; noteIds: string[] }
      ): void => {
        callback(data);
      };
      ipcRenderer.on('test:activity-sync-complete', listener);
      return () => {
        ipcRenderer.removeListener('test:activity-sync-complete', listener);
      };
    },
    onActivityWatcherDebug: (
      callback: (data: {
        sdId: string;
        filename: string;
        reason: string;
        instanceId?: string;
      }) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: { sdId: string; filename: string; reason: string; instanceId?: string }
      ): void => {
        callback(data);
      };
      ipcRenderer.on('test:activity-watcher-debug', listener);
      return () => {
        ipcRenderer.removeListener('test:activity-watcher-debug', listener);
      };
    },
  },

  // Web Server operations
  webServer: {
    start: (
      port?: number
    ): Promise<{
      running: boolean;
      port: number | null;
      url: string | null;
      token: string | null;
      connectedClients: number;
      localhostOnly: boolean;
      tlsMode: 'off' | 'self-signed' | 'custom';
      tlsEnabled: boolean;
    }> =>
      ipcRenderer.invoke('webServer:start', port) as Promise<{
        running: boolean;
        port: number | null;
        url: string | null;
        token: string | null;
        connectedClients: number;
        localhostOnly: boolean;
        tlsMode: 'off' | 'self-signed' | 'custom';
        tlsEnabled: boolean;
      }>,
    stop: (): Promise<void> => ipcRenderer.invoke('webServer:stop') as Promise<void>,
    getStatus: (): Promise<{
      running: boolean;
      port: number | null;
      url: string | null;
      token: string | null;
      connectedClients: number;
      localhostOnly: boolean;
      tlsMode: 'off' | 'self-signed' | 'custom';
      tlsEnabled: boolean;
    }> =>
      ipcRenderer.invoke('webServer:getStatus') as Promise<{
        running: boolean;
        port: number | null;
        url: string | null;
        token: string | null;
        connectedClients: number;
        localhostOnly: boolean;
        tlsMode: 'off' | 'self-signed' | 'custom';
        tlsEnabled: boolean;
      }>,
    getSettings: (): Promise<{
      port: number;
      localhostOnly: boolean;
      tlsMode: 'off' | 'self-signed' | 'custom';
      customCertPath?: string;
      customKeyPath?: string;
    }> =>
      ipcRenderer.invoke('webServer:getSettings') as Promise<{
        port: number;
        localhostOnly: boolean;
        tlsMode: 'off' | 'self-signed' | 'custom';
        customCertPath?: string;
        customKeyPath?: string;
      }>,
    setSettings: (settings: {
      port?: number;
      localhostOnly?: boolean;
      tlsMode?: 'off' | 'self-signed' | 'custom';
      customCertPath?: string;
      customKeyPath?: string;
    }): Promise<void> => ipcRenderer.invoke('webServer:setSettings', settings) as Promise<void>,
    regenerateToken: (): Promise<string> =>
      ipcRenderer.invoke('webServer:regenerateToken') as Promise<string>,
    getConnectedClients: (): Promise<
      {
        id: string;
        ip: string;
        userAgent: string;
        connectedAt: number;
      }[]
    > =>
      ipcRenderer.invoke('webServer:getConnectedClients') as Promise<
        {
          id: string;
          ip: string;
          userAgent: string;
          connectedAt: number;
        }[]
      >,
    disconnectClient: (clientId: string): Promise<boolean> =>
      ipcRenderer.invoke('webServer:disconnectClient', clientId) as Promise<boolean>,
    disconnectAllClients: (): Promise<void> =>
      ipcRenderer.invoke('webServer:disconnectAllClients') as Promise<void>,
    getCertificateInfo: (): Promise<{
      commonName: string;
      validFrom: string;
      validTo: string;
      isSelfSigned: boolean;
      fingerprint: string;
      path: string;
    } | null> => ipcRenderer.invoke('webServer:getCertificateInfo'),
  },

  // Profile operations (for debugging)
  profile: {
    getInfo: (): Promise<{
      profileId: string | null;
      profile: { id: string; name: string; isDev: boolean } | null;
      isDevBuild: boolean;
    }> => ipcRenderer.invoke('profile:getInfo'),
  },

  // App info operations (for titlebar and About dialog)
  app: {
    getInfo: (): Promise<{
      version: string;
      isDevBuild: boolean;
      profileId: string | null;
      profileName: string | null;
    }> => ipcRenderer.invoke('app:getInfo'),
  },

  // Shell operations (for opening external URLs)
  shell: {
    openExternal: (url: string): Promise<void> =>
      ipcRenderer.invoke('shell:openExternal', url) as Promise<void>,
  },

  // Clipboard operations (for testing and copy functionality)
  clipboard: {
    writeText: (text: string): Promise<void> =>
      ipcRenderer.invoke('clipboard:writeText', text) as Promise<void>,
    readText: (): Promise<string> => ipcRenderer.invoke('clipboard:readText') as Promise<string>,
  },
});

// Set window.__NOTECOVE_PROFILE__ for DevTools inspection
void ipcRenderer.invoke('profile:getInfo').then((info: unknown) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  (window as any).__NOTECOVE_PROFILE__ = info;
});
