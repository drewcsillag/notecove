/**
 * Shared types for NoteCove
 */

/**
 * UUID type alias for clarity
 */
export type UUID = string;

/**
 * Note metadata
 */
export interface NoteMetadata {
  id: UUID;
  created: number; // timestamp
  modified: number; // timestamp
  sdId: UUID; // Storage Directory ID
  folderId: UUID | null; // null for orphan notes
  deleted: boolean;
}

/**
 * Folder data
 */
export interface FolderData {
  id: UUID;
  name: string;
  parentId: UUID | null; // null for root-level folders
  sdId: string;
  order: number;
  deleted: boolean;
}

/**
 * User information for CRDT metadata
 */
export interface UserInfo {
  userId: UUID;
  username: string;
  timestamp: number;
}

/**
 * Instance information
 */
export interface InstanceInfo {
  instanceId: UUID;
  username: string;
}

/**
 * Storage Directory metadata
 *
 * A Storage Directory (SD) represents a sync directory containing notes and folders.
 * Multiple SDs allow users to have separate collections (e.g., work vs personal).
 */
export interface StorageDir {
  /** Unique identifier for the storage directory */
  id: UUID;

  /** User-visible name for the storage directory */
  name: string;

  /** File system path to the sync directory */
  path: string;

  /** Timestamp when this SD was created */
  created: number;
}

/**
 * Storage Directory creation parameters
 */
export interface CreateStorageDirParams {
  /** User-visible name for the storage directory */
  name: string;

  /** File system path to the sync directory */
  path: string;
}
