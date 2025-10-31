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
        getState: (noteId: string) => Promise<Uint8Array>;
        applyUpdate: (noteId: string, update: Uint8Array) => Promise<void>;
        create: (sdId: string, folderId: string, initialContent: string) => Promise<string>;
        delete: (noteId: string) => Promise<void>;
        restore: (noteId: string) => Promise<void>;
        togglePin: (noteId: string) => Promise<void>;
        move: (noteId: string, newFolderId: string | null) => Promise<void>;
        getMetadata: (noteId: string) => Promise<NoteMetadata>;
        updateTitle: (noteId: string, title: string, contentText?: string) => Promise<void>;
        list: (
          sdId: string,
          folderId?: string | null
        ) => Promise<
          {
            id: string;
            title: string;
            sdId: string;
            folderId: string | null;
            created: number;
            modified: number;
            deleted: boolean;
            pinned: boolean;
            contentPreview: string;
            contentText: string;
          }[]
        >;
        search: (
          query: string,
          limit?: number
        ) => Promise<
          {
            noteId: string;
            title: string;
            snippet: string;
            rank: number;
          }[]
        >;
        onUpdated: (callback: (noteId: string, update: Uint8Array) => void) => () => void;
        onDeleted: (callback: (noteId: string) => void) => () => void;
        onRestored: (callback: (noteId: string) => void) => () => void;
        onPinned: (callback: (data: { noteId: string; pinned: boolean }) => void) => () => void;
        onCreated: (
          callback: (data: { sdId: string; noteId: string; folderId: string | null }) => void
        ) => () => void;
        onExternalUpdate: (
          callback: (data: { operation: string; noteIds: string[] }) => void
        ) => () => void;
        onTitleUpdated: (callback: (data: { noteId: string; title: string }) => void) => () => void;
        onMoved: (
          callback: (data: {
            noteId: string;
            oldFolderId: string | null;
            newFolderId: string | null;
          }) => void
        ) => () => void;
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
        move: (sdId: string, folderId: string, newParentId: string | null) => Promise<void>;
        onUpdated: (
          callback: (data: { sdId: string; operation: string; folderId: string }) => void
        ) => () => void;
      };

      sd: {
        list: () => Promise<
          {
            id: string;
            name: string;
            path: string;
            created: number;
            isActive: boolean;
          }[]
        >;
        create: (name: string, path: string) => Promise<string>;
        setActive: (sdId: string) => Promise<void>;
        getActive: () => Promise<string | null>;
        onUpdated: (callback: (data: { operation: string; sdId: string }) => void) => () => void;
      };

      sync: {
        onProgress: (callback: (sdId: string, progress: SyncProgress) => void) => () => void;
      };

      appState: {
        get: (key: string) => Promise<string | null>;
        set: (key: string, value: string) => Promise<void>;
      };

      testing: {
        createWindow: () => Promise<void>;
      };
    };
  }
}

export {};
