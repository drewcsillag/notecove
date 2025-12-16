/**
 * Storage Directory (SD) API
 */

import { ipcRenderer } from 'electron';

export const sdApi = {
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
};
