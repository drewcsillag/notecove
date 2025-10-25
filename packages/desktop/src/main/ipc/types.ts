/**
 * IPC Protocol Types
 *
 * Defines the communication protocol between main and renderer processes.
 */

/**
 * Commands (renderer → main)
 */
export interface IPCCommands {
  // Note operations
  'note:load': (noteId: string) => Promise<void>;
  'note:unload': (noteId: string) => Promise<void>;
  'note:applyUpdate': (noteId: string, update: Uint8Array) => Promise<void>;
  'note:create': (sdId: string, folderId: string, initialContent: string) => Promise<string>;
  'note:delete': (noteId: string) => Promise<void>;
  'note:move': (noteId: string, newFolderId: string) => Promise<void>;
  'note:getMetadata': (noteId: string) => Promise<NoteMetadata>;

  // Folder operations
  'folder:create': (sdId: string, parentId: string, name: string) => Promise<string>;
  'folder:delete': (folderId: string) => Promise<void>;

  // App state operations
  'appState:get': (key: string) => Promise<string | null>;
  'appState:set': (key: string, value: string) => Promise<void>;
}

/**
 * Events (main → renderer)
 */
export interface IPCEvents {
  // Note events
  'note:updated': (noteId: string, update: Uint8Array) => void;
  'note:deleted': (noteId: string) => void;

  // Folder events
  'folder:updated': (folderId: string) => void;

  // Sync events
  'sync:progress': (sdId: string, progress: SyncProgress) => void;
}

/**
 * Note metadata
 */
export interface NoteMetadata {
  noteId: string;
  title: string;
  folderId: string;
  createdAt: number;
  modifiedAt: number;
}

/**
 * Sync progress information
 */
export interface SyncProgress {
  sdId: string;
  totalFiles: number;
  processedFiles: number;
  phase: 'scanning' | 'indexing' | 'complete';
}
