/**
 * Database schema definitions
 * These types define the structure of the SQLite database used for caching
 * and indexing CRDT data for fast access
 */

import type { UUID } from '../types';

/**
 * Note cache entry
 * Cached data extracted from CRDT for fast access
 */
export interface NoteCache {
  id: UUID;
  title: string;
  sdId: string;
  folderId: UUID | null;
  created: number;
  modified: number;
  deleted: boolean;
  pinned: boolean; // Whether note is pinned to top of list
  contentPreview: string; // First ~200 chars of note content
  contentText: string; // Full plain text for FTS5 search
}

/**
 * Folder cache entry
 */
export interface FolderCache {
  id: UUID;
  name: string;
  parentId: UUID | null;
  sdId: string;
  order: number;
  deleted: boolean;
}

/**
 * Tag definition
 */
export interface Tag {
  id: UUID;
  name: string; // Case-insensitive
}

/**
 * Note-Tag association
 */
export interface NoteTag {
  noteId: UUID;
  tagId: UUID;
}

/**
 * Inter-Note Link
 * Represents a link from one note to another
 */
export interface NoteLink {
  sourceNoteId: UUID; // Note containing the link
  targetNoteId: UUID; // Note being linked to
}

/**
 * User information
 */
export interface User {
  id: UUID;
  username: string;
  lastSeen: number;
}

/**
 * Storage Directory (SD) entry
 */
export interface StorageDirCache {
  id: string;
  name: string;
  path: string;
  uuid: string | null; // Globally unique identifier for cross-instance coordination
  created: number;
  isActive: boolean; // Only one SD can be active at a time
}

/**
 * Note move operation state
 */
export type NoteMoveState =
  | 'initiated'
  | 'copying'
  | 'files_copied'
  | 'db_updated'
  | 'cleaning'
  | 'completed'
  | 'cancelled'
  | 'rolled_back';

/**
 * Note move operation record
 */
export interface NoteMove {
  id: string; // UUID for the move operation
  noteId: string; // Note being moved
  sourceSdUuid: string; // Source SD UUID
  targetSdUuid: string; // Target SD UUID
  targetFolderId: string | null; // Target folder (null = All Notes)
  state: NoteMoveState; // Current state
  initiatedBy: string; // Instance ID that started the move
  initiatedAt: number; // Timestamp (milliseconds)
  lastModified: number; // Timestamp (milliseconds)
  sourceSdPath: string | null; // Original path (informational)
  targetSdPath: string | null; // Original path (informational)
  error: string | null; // Last error message if any
}

/**
 * App state key-value pairs
 */
export interface AppState {
  key: string;
  value: string; // JSON-serialized value
}

/**
 * Schema version record
 */
export interface SchemaVersionRecord {
  version: number;
  appliedAt: number;
  description: string;
}

/**
 * App state keys (typed for common UI state)
 */
export enum AppStateKey {
  LastOpenedNote = 'lastOpenedNote',
  LeftPanelWidth = 'leftPanelWidth',
  RightPanelWidth = 'rightPanelWidth',
  PanelSizes = 'panelSizes', // Array of panel sizes: [left%, middle%, right%]
  FolderCollapseState = 'folderCollapseState',
  TagFilters = 'tagFilters',
  SearchText = 'searchText',
  WindowPosition = 'windowPosition',
  WindowSize = 'windowSize',
  ThemeMode = 'themeMode', // 'light' or 'dark'
  Username = 'username', // User's display name
  UserHandle = 'userHandle', // User's @mention handle
}

/**
 * Search result from FTS5
 */
export interface SearchResult {
  noteId: UUID;
  title: string;
  snippet: string; // Highlighted snippet from search
  rank: number; // FTS5 rank score
}

/**
 * Database schema version
 *
 * Version history:
 * - v1: Initial schema
 * - v2: Added pinned field to notes table
 * - v3: Added uuid to storage_dirs, added note_moves table
 * - v4: Added note_links table for inter-note links
 *
 * Migration strategy:
 * - Cache tables (notes, folders, notes_fts): Rebuild from CRDT on version mismatch
 * - User data tables (tags, note_tags, note_links, app_state): Migrate with version-specific logic
 */
export const SCHEMA_VERSION = 4;

/**
 * SQL schema definitions
 */
export const SCHEMA_SQL = {
  /**
   * Note cache table
   */
  notes: `
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      sd_id TEXT NOT NULL,
      folder_id TEXT,
      created INTEGER NOT NULL,
      modified INTEGER NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      pinned INTEGER NOT NULL DEFAULT 0,
      content_preview TEXT NOT NULL,
      content_text TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notes_sd_id ON notes(sd_id);
    CREATE INDEX IF NOT EXISTS idx_notes_folder_id ON notes(folder_id);
    CREATE INDEX IF NOT EXISTS idx_notes_deleted ON notes(deleted);
    CREATE INDEX IF NOT EXISTS idx_notes_modified ON notes(modified);
    CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(pinned);
  `,

  /**
   * FTS5 full-text search for note content
   */
  notesFts: `
    CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
      note_id UNINDEXED,
      title,
      content,
      content=notes,
      content_rowid=rowid
    );

    -- Triggers to keep FTS index in sync
    CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
      INSERT INTO notes_fts(rowid, note_id, title, content)
      VALUES (new.rowid, new.id, new.title, new.content_text);
    END;

    CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
      DELETE FROM notes_fts WHERE rowid = old.rowid;
    END;

    CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
      DELETE FROM notes_fts WHERE rowid = old.rowid;
      INSERT INTO notes_fts(rowid, note_id, title, content)
      VALUES (new.rowid, new.id, new.title, new.content_text);
    END;
  `,

  /**
   * Folder cache table
   */
  folders: `
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT,
      sd_id TEXT NOT NULL,
      "order" INTEGER NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_folders_sd_id ON folders(sd_id);
    CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);
  `,

  /**
   * Tags table
   */
  tags: `
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE
    );

    CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name COLLATE NOCASE);
  `,

  /**
   * Note-Tag association table
   */
  noteTags: `
    CREATE TABLE IF NOT EXISTS note_tags (
      note_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      PRIMARY KEY (note_id, tag_id),
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_note_tags_note_id ON note_tags(note_id);
    CREATE INDEX IF NOT EXISTS idx_note_tags_tag_id ON note_tags(tag_id);
  `,

  /**
   * Inter-Note Links table
   * Tracks links from one note to another
   */
  noteLinks: `
    CREATE TABLE IF NOT EXISTS note_links (
      source_note_id TEXT NOT NULL,
      target_note_id TEXT NOT NULL,
      PRIMARY KEY (source_note_id, target_note_id),
      FOREIGN KEY (source_note_id) REFERENCES notes(id) ON DELETE CASCADE,
      FOREIGN KEY (target_note_id) REFERENCES notes(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_note_links_source ON note_links(source_note_id);
    CREATE INDEX IF NOT EXISTS idx_note_links_target ON note_links(target_note_id);
  `,

  /**
   * Users table
   */
  users: `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      last_seen INTEGER NOT NULL
    );
  `,

  /**
   * Storage Directories table
   */
  storageDirs: `
    CREATE TABLE IF NOT EXISTS storage_dirs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      path TEXT NOT NULL UNIQUE,
      uuid TEXT,
      created INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_storage_dirs_is_active ON storage_dirs(is_active);
    CREATE INDEX IF NOT EXISTS idx_storage_dirs_uuid ON storage_dirs(uuid);
  `,

  /**
   * Note Moves table (for atomic cross-SD move operations)
   */
  noteMoves: `
    CREATE TABLE IF NOT EXISTS note_moves (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL,
      source_sd_uuid TEXT NOT NULL,
      target_sd_uuid TEXT NOT NULL,
      target_folder_id TEXT,
      state TEXT NOT NULL,
      initiated_by TEXT NOT NULL,
      initiated_at INTEGER NOT NULL,
      last_modified INTEGER NOT NULL,
      source_sd_path TEXT,
      target_sd_path TEXT,
      error TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_note_moves_state ON note_moves(state);
    CREATE INDEX IF NOT EXISTS idx_note_moves_note_id ON note_moves(note_id);
    CREATE INDEX IF NOT EXISTS idx_note_moves_last_modified ON note_moves(last_modified);
  `,

  /**
   * App state table
   */
  appState: `
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `,

  /**
   * Schema version table
   * Tracks current schema version and migration history
   */
  version: `
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL,
      description TEXT NOT NULL
    );
  `,
};
