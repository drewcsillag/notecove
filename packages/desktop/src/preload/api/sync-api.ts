/**
 * Sync and Recovery API
 */

import { ipcRenderer } from 'electron';
import type { SyncProgress, SyncStatus, StaleSyncEntry } from '../../main/ipc/types';

export const syncApi = {
  openWindow: (): Promise<void> => ipcRenderer.invoke('sync:openWindow') as Promise<void>,
  getStatus: (): Promise<SyncStatus> => ipcRenderer.invoke('sync:getStatus') as Promise<SyncStatus>,
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
};

export const recoveryApi = {
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
};
