/**
 * Note-related API: note operations, history, tags, and links
 */

import { ipcRenderer } from 'electron';
import type { NoteMetadata } from '../../main/ipc/types';
import type { NoteCache } from '@notecove/shared';

export const noteApi = {
  load: (noteId: string): Promise<void> => ipcRenderer.invoke('note:load', noteId) as Promise<void>,
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
  emptyTrash: (sdId: string): Promise<number> =>
    ipcRenderer.invoke('note:emptyTrash', sdId) as Promise<number>,
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
      fullFolderPath: string;
      created: number;
      modified: number;
      tags: string[];
      characterCount: number;
      wordCount: number;
      paragraphCount: number;
      vectorClock: Record<string, { sequence: number; offset: number; file: string }>;
      documentHash: string;
      crdtUpdateCount: number;
      noteDirPath: string;
      totalFileSize: number;
      snapshotCount: number;
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
  onTitleUpdated: (
    callback: (data: {
      noteId: string;
      title: string;
      modified: number;
      contentPreview?: string;
    }) => void
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: { noteId: string; title: string; modified: number; contentPreview?: string }
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
  onModifiedUpdated: (
    callback: (data: { noteId: string; modified: number }) => void
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: { noteId: string; modified: number }
    ): void => {
      callback(data);
    };
    ipcRenderer.on('note:modified-updated', listener);
    return () => {
      ipcRenderer.removeListener('note:modified-updated', listener);
    };
  },
};

export const historyApi = {
  getTimeline: (noteId: string) => ipcRenderer.invoke('history:getTimeline', noteId),
  getStats: (noteId: string) => ipcRenderer.invoke('history:getStats', noteId),
  reconstructAt: (noteId: string, point: { timestamp: number; updateIndex?: number }) =>
    ipcRenderer.invoke('history:reconstructAt', noteId, point),
  getSessionPreview: (noteId: string, sessionId: string) =>
    ipcRenderer.invoke('history:getSessionPreview', noteId, sessionId),
};

export const tagApi = {
  getAll: (): Promise<{ id: string; name: string; count: number }[]> =>
    ipcRenderer.invoke('tag:getAll') as Promise<{ id: string; name: string; count: number }[]>,
};

export const linkApi = {
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
};
