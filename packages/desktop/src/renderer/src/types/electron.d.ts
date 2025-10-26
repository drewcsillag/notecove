/**
 * Electron API Type Definitions for Renderer
 */

import type { NoteMetadata, SyncProgress } from '../../../main/ipc/types';

declare global {
  interface Window {
    electronAPI: {
      platform: string;

      note: {
        load: (noteId: string) => Promise<void>;
        unload: (noteId: string) => Promise<void>;
        applyUpdate: (noteId: string, update: Uint8Array) => Promise<void>;
        create: (sdId: string, folderId: string, initialContent: string) => Promise<string>;
        delete: (noteId: string) => Promise<void>;
        move: (noteId: string, newFolderId: string) => Promise<void>;
        getMetadata: (noteId: string) => Promise<NoteMetadata>;
        onUpdated: (callback: (noteId: string, update: Uint8Array) => void) => () => void;
        onDeleted: (callback: (noteId: string) => void) => () => void;
      };

      folder: {
        list: (sdId: string) => Promise<
          {
            id: string;
            name: string;
            parentId: string | null;
            sdId: string;
            order: number;
            deleted: boolean;
          }[]
        >;
        get: (
          sdId: string,
          folderId: string
        ) => Promise<{
          id: string;
          name: string;
          parentId: string | null;
          sdId: string;
          order: number;
          deleted: boolean;
        } | null>;
        create: (sdId: string, parentId: string | null, name: string) => Promise<string>;
        rename: (sdId: string, folderId: string, newName: string) => Promise<void>;
        delete: (sdId: string, folderId: string) => Promise<void>;
        onUpdated: (callback: (folderId: string) => void) => () => void;
      };

      sync: {
        onProgress: (callback: (sdId: string, progress: SyncProgress) => void) => () => void;
      };

      appState: {
        get: (key: string) => Promise<string | null>;
        set: (key: string, value: string) => Promise<void>;
      };
    };
  }
}

export {};
