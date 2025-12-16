/**
 * Folder-related API
 */

import { ipcRenderer } from 'electron';

export const folderApi = {
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
};
