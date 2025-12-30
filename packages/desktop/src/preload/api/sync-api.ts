/**
 * Sync and Recovery API
 */

import { ipcRenderer } from 'electron';
import type { SyncProgress, SyncStatus } from '../../main/ipc/types';
import type { PollingGroupStoredSettings, PollingGroupStatus } from '@notecove/shared';

export const pollingApi = {
  getSettings: (): Promise<PollingGroupStoredSettings> =>
    ipcRenderer.invoke('polling:getSettings') as Promise<PollingGroupStoredSettings>,
  setSettings: (settings: Partial<PollingGroupStoredSettings>): Promise<void> =>
    ipcRenderer.invoke('polling:setSettings', settings) as Promise<void>,
  getSettingsForSd: (sdId: string): Promise<PollingGroupStoredSettings> =>
    ipcRenderer.invoke('polling:getSettingsForSd', sdId) as Promise<PollingGroupStoredSettings>,
  setSettingsForSd: (sdId: string, settings: Partial<PollingGroupStoredSettings>): Promise<void> =>
    ipcRenderer.invoke('polling:setSettingsForSd', sdId, settings) as Promise<void>,
  getGroupStatus: (): Promise<PollingGroupStatus | null> =>
    ipcRenderer.invoke('polling:getGroupStatus') as Promise<PollingGroupStatus | null>,
};

export const syncApi = {
  openWindow: (): Promise<void> => ipcRenderer.invoke('sync:openWindow') as Promise<void>,
  getStatus: (): Promise<SyncStatus> => ipcRenderer.invoke('sync:getStatus') as Promise<SyncStatus>,
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
