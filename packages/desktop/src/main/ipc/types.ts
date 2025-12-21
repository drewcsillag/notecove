/**
 * IPC Protocol Types
 *
 * Defines the communication protocol between main and renderer processes.
 */

import type { NoteCache, StorageDir } from '@notecove/shared';

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
  'note:list': (sdId: string, folderId?: string | null) => Promise<NoteCache[]>;

  // Folder operations
  'folder:create': (sdId: string, parentId: string, name: string) => Promise<string>;
  'folder:delete': (folderId: string) => Promise<void>;

  // Storage Directory operations
  'sd:list': () => Promise<StorageDir[]>;
  'sd:create': (name: string, path: string) => Promise<string>;
  'sd:setActive': (sdId: string) => Promise<void>;
  'sd:getActive': () => Promise<string | null>;

  // App state operations
  'appState:get': (key: string) => Promise<string | null>;
  'appState:set': (key: string, value: string) => Promise<void>;

  // Sync status operations
  'sync:getStatus': () => Promise<SyncStatus>;
  'sync:getStaleSyncs': () => Promise<StaleSyncEntry[]>;
  'sync:skipStaleEntry': (
    sdId: string,
    noteId: string,
    sourceInstanceId: string
  ) => Promise<{ success: boolean; error?: string }>;
  'sync:retryStaleEntry': (
    sdId: string,
    noteId: string,
    sourceInstanceId: string
  ) => Promise<{ success: boolean; error?: string }>;
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
  'sync:status-changed': (status: SyncStatus) => void;
  'sync:stale-entries-changed': (entries: StaleSyncEntry[]) => void;
}

/**
 * Note metadata
 */
export interface NoteMetadata {
  noteId: string;
  sdId: string;
  title: string;
  folderId: string;
  createdAt: number;
  modifiedAt: number;
  deleted: boolean;
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

/**
 * Sync status information for UI status indicator
 */
export interface SyncStatus {
  /** Total pending sync count across all SDs */
  pendingCount: number;
  /** Per-SD sync status */
  perSd: {
    sdId: string;
    sdName: string;
    pendingCount: number;
    pendingNoteIds: string[];
  }[];
  /** Whether any sync is in progress */
  isSyncing: boolean;
}

/**
 * Stale sync entry information for UI display
 */
export interface StaleSyncEntry {
  /** Storage directory ID */
  sdId: string;
  /** Storage directory name */
  sdName: string;
  /** Note ID affected by the stale entry */
  noteId: string;
  /** Note title (if available) */
  noteTitle?: string;
  /** Instance ID that created the stale entry */
  sourceInstanceId: string;
  /** Expected sequence number that will never arrive */
  expectedSequence: number;
  /** Highest sequence for THIS note from that instance (not global) */
  highestSequenceForNote: number;
  /** Sequence gap */
  gap: number;
  /** When the stale entry was detected */
  detectedAt: number;
  /** Profile info for the source instance (if available from presence files) */
  sourceProfile?: {
    profileId: string;
    profileName: string;
    hostname: string;
    lastSeen: number;
  };
}
