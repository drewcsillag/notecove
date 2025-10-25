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
