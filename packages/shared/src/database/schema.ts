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
 * Checkbox (Task) entry
 * Represents a tri-state checkbox from a note
 */
export interface Checkbox {
  id: UUID; // Unique ID for this checkbox
  noteId: UUID; // Note containing the checkbox
  state: 'unchecked' | 'checked' | 'nope'; // Checkbox state
  text: string; // Text content after the checkbox
  position: number; // Position in note (for ordering)
  created: number; // Timestamp when checkbox was created
  modified: number; // Timestamp when checkbox state was last changed
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
  WindowStates = 'windowStates', // Array of WindowState for session restoration
}

/**
 * Window bounds (position and size)
 */
export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Editor state for a window (scroll and cursor position)
 */
export interface EditorState {
  scrollTop: number;
  cursorPosition: number; // Character offset in document
}

/**
 * Window state for session restoration
 * Stores position, size, and content state for each window
 */
export interface WindowState {
  id: string; // Unique window ID (UUID)
  type: 'main' | 'minimal' | 'syncStatus' | 'noteInfo' | 'storageInspector' | 'sdPicker';
  noteId?: string | undefined; // For minimal windows, or current note in main
  sdId?: string | undefined; // Storage Directory ID for the note
  bounds: WindowBounds;
  isMaximized: boolean;
  isFullScreen: boolean;
  editorState?: EditorState | undefined; // Scroll/cursor position
}

/**
 * Serialize window states array to JSON string for storage
 */
export function serializeWindowStates(states: WindowState[]): string {
  return JSON.stringify(states);
}

/**
 * Deserialize window states from JSON string
 * Returns empty array if input is null, invalid, or not an array
 */
export function deserializeWindowStates(json: string | null): WindowState[] {
  if (!json) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed as WindowState[];
  } catch {
    return [];
  }
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
 * Note sync state for new append-only log format
 */
export interface NoteSyncState {
  noteId: string;
  sdId: string;
  vectorClock: string; // JSON: { [instanceId]: { sequence, offset, file } }
  documentState: Uint8Array; // Yjs encoded state
  updatedAt: number;
}

/**
 * Folder tree sync state
 */
export interface FolderSyncState {
  sdId: string;
  vectorClock: string; // JSON
  documentState: Uint8Array;
  updatedAt: number;
}

/**
 * Activity log consumption state
 */
export interface ActivityLogState {
  sdId: string;
  instanceId: string;
  lastOffset: number;
  logFile: string;
}

/**
 * Image cache entry
 * Tracks image metadata for images stored in sync directories
 */
export interface ImageCache {
  id: UUID; // UUID (same as filename without extension)
  sdId: string; // Which sync directory this image belongs to
  filename: string; // Full filename with extension (e.g., "abc123.png")
  mimeType: string; // e.g., "image/png"
  width: number | null; // Original width in pixels (nullable until analyzed)
  height: number | null; // Original height in pixels (nullable until analyzed)
  size: number; // File size in bytes
  created: number; // Timestamp when image was added
}

/**
 * Sequence state for tracking write position
 */
export interface SequenceState {
  sdId: string;
  documentId: string; // noteId or 'folders'
  currentSequence: number;
  currentFile: string;
  currentOffset: number;
}

/**
 * Cached profile presence from SD presence files
 * @see plans/stale-sync-ux/PROFILE-PRESENCE.md
 */
export interface CachedProfilePresence {
  profileId: string;
  instanceId: string | null;
  sdId: string;
  profileName: string | null;
  user: string | null;
  username: string | null;
  hostname: string | null;
  platform: string | null;
  appVersion: string | null;
  lastUpdated: number | null;
  cachedAt: number;
}

/**
 * Comment thread cache entry
 * Cached data extracted from CRDT for fast access
 * @see plans/note-comments/PLAN.md
 */
export interface CommentThreadCache {
  id: UUID;
  noteId: UUID;
  anchorStart: Uint8Array;
  anchorEnd: Uint8Array;
  originalText: string;
  authorId: string;
  authorName: string;
  authorHandle: string;
  content: string;
  created: number;
  modified: number;
  resolved: boolean;
  resolvedBy: string | null;
  resolvedAt: number | null;
}

/**
 * Comment reply cache entry
 * @see plans/note-comments/PLAN.md
 */
export interface CommentReplyCache {
  id: UUID;
  threadId: UUID;
  authorId: string;
  authorName: string;
  authorHandle: string;
  content: string;
  created: number;
  modified: number;
}

/**
 * Comment reaction cache entry
 * @see plans/note-comments/PLAN.md
 */
export interface CommentReactionCache {
  id: UUID;
  targetType: 'thread' | 'reply';
  targetId: UUID;
  emoji: string;
  authorId: string;
  authorName: string;
  created: number;
}

/**
 * Database schema version
 *
 * Version history:
 * - v1: Initial schema
 * - v2: Added pinned field to notes table
 * - v3: Added uuid to storage_dirs, added note_moves table
 * - v4: Added note_links table for inter-note links
 * - v5: Added checkboxes table for tri-state task tracking
 * - v6: Added note_sync_state, folder_sync_state, activity_log_state, sequence_state tables for new append-only log format
 * - v7: Added instance_id column and index to profile_presence_cache for proper activity log lookups
 * - v8: Added images table for image metadata caching
 * - v9: Added comment_threads, comment_replies, comment_reactions tables for note comments
 *
 * Migration strategy:
 * - Cache tables (notes, folders, notes_fts): Rebuild from CRDT on version mismatch
 * - User data tables (tags, note_tags, note_links, checkboxes, app_state): Migrate with version-specific logic
 * - Sync state tables: Safe to recreate (will rebuild from files)
 * - Comment tables: Cache only, safe to recreate (rebuilt from CRDT)
 */
export const SCHEMA_VERSION = 9;

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
   * Checkboxes table
   * Tracks tri-state checkboxes/tasks from notes
   */
  checkboxes: `
    CREATE TABLE IF NOT EXISTS checkboxes (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL,
      state TEXT NOT NULL CHECK(state IN ('unchecked', 'checked', 'nope')),
      text TEXT NOT NULL,
      position INTEGER NOT NULL,
      created INTEGER NOT NULL,
      modified INTEGER NOT NULL,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_checkboxes_note_id ON checkboxes(note_id);
    CREATE INDEX IF NOT EXISTS idx_checkboxes_state ON checkboxes(state);
    CREATE INDEX IF NOT EXISTS idx_checkboxes_modified ON checkboxes(modified);
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

  /**
   * Note sync state table
   * Stores vector clock and document state for each note
   */
  noteSyncState: `
    CREATE TABLE IF NOT EXISTS note_sync_state (
      note_id TEXT NOT NULL,
      sd_id TEXT NOT NULL,
      vector_clock TEXT NOT NULL,
      document_state BLOB NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (note_id, sd_id)
    );

    CREATE INDEX IF NOT EXISTS idx_note_sync_state_sd_id ON note_sync_state(sd_id);
    CREATE INDEX IF NOT EXISTS idx_note_sync_state_updated_at ON note_sync_state(updated_at);
  `,

  /**
   * Folder sync state table
   * Stores vector clock and document state for folder tree per SD
   */
  folderSyncState: `
    CREATE TABLE IF NOT EXISTS folder_sync_state (
      sd_id TEXT PRIMARY KEY,
      vector_clock TEXT NOT NULL,
      document_state BLOB NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `,

  /**
   * Activity log state table
   * Tracks consumption position in other instances' activity logs
   */
  activityLogState: `
    CREATE TABLE IF NOT EXISTS activity_log_state (
      sd_id TEXT NOT NULL,
      instance_id TEXT NOT NULL,
      last_offset INTEGER NOT NULL,
      log_file TEXT NOT NULL,
      PRIMARY KEY (sd_id, instance_id)
    );

    CREATE INDEX IF NOT EXISTS idx_activity_log_state_sd_id ON activity_log_state(sd_id);
  `,

  /**
   * Sequence state table
   * Tracks current write position for each document
   */
  sequenceState: `
    CREATE TABLE IF NOT EXISTS sequence_state (
      sd_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      current_sequence INTEGER NOT NULL,
      current_file TEXT NOT NULL,
      current_offset INTEGER NOT NULL,
      PRIMARY KEY (sd_id, document_id)
    );

    CREATE INDEX IF NOT EXISTS idx_sequence_state_sd_id ON sequence_state(sd_id);
  `,

  /**
   * Profile presence cache table
   * Caches profile presence info from SDs for the Stale Sync UI
   * @see plans/stale-sync-ux/PROFILE-PRESENCE.md
   *
   * Note: instance_id column and its index are added via migration (v7) to support
   * existing databases. For new databases, the migration also runs to ensure the
   * index is created.
   */
  profilePresenceCache: `
    CREATE TABLE IF NOT EXISTS profile_presence_cache (
      profile_id TEXT NOT NULL,
      sd_id TEXT NOT NULL,
      profile_name TEXT,
      user TEXT,
      username TEXT,
      hostname TEXT,
      platform TEXT,
      app_version TEXT,
      last_updated INTEGER,
      cached_at INTEGER NOT NULL,
      PRIMARY KEY (profile_id, sd_id)
    );

    CREATE INDEX IF NOT EXISTS idx_profile_presence_cache_sd_id ON profile_presence_cache(sd_id);
  `,

  /**
   * Images table
   * Tracks metadata for images stored in sync directory media folders
   * @see plans/add-images/PLAN-PHASE-1.md
   */
  images: `
    CREATE TABLE IF NOT EXISTS images (
      id TEXT PRIMARY KEY,
      sd_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      width INTEGER,
      height INTEGER,
      size INTEGER NOT NULL,
      created INTEGER NOT NULL,
      FOREIGN KEY (sd_id) REFERENCES storage_dirs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_images_sd_id ON images(sd_id);
  `,

  /**
   * Comment threads table
   * Stores comment threads anchored to text selections in notes
   * @see plans/note-comments/PLAN.md
   */
  commentThreads: `
    CREATE TABLE IF NOT EXISTS comment_threads (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL,
      anchor_start BLOB NOT NULL,
      anchor_end BLOB NOT NULL,
      original_text TEXT NOT NULL,
      author_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_handle TEXT NOT NULL,
      content TEXT NOT NULL,
      created INTEGER NOT NULL,
      modified INTEGER NOT NULL,
      resolved INTEGER NOT NULL DEFAULT 0,
      resolved_by TEXT,
      resolved_at INTEGER,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_comment_threads_note_id ON comment_threads(note_id);
    CREATE INDEX IF NOT EXISTS idx_comment_threads_resolved ON comment_threads(resolved);
  `,

  /**
   * Comment replies table
   * Stores replies to comment threads (single-level threading)
   * @see plans/note-comments/PLAN.md
   */
  commentReplies: `
    CREATE TABLE IF NOT EXISTS comment_replies (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_handle TEXT NOT NULL,
      content TEXT NOT NULL,
      created INTEGER NOT NULL,
      modified INTEGER NOT NULL,
      FOREIGN KEY (thread_id) REFERENCES comment_threads(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_comment_replies_thread_id ON comment_replies(thread_id);
  `,

  /**
   * Comment reactions table
   * Stores emoji reactions on threads or replies
   * @see plans/note-comments/PLAN.md
   */
  commentReactions: `
    CREATE TABLE IF NOT EXISTS comment_reactions (
      id TEXT PRIMARY KEY,
      target_type TEXT NOT NULL CHECK(target_type IN ('thread', 'reply')),
      target_id TEXT NOT NULL,
      emoji TEXT NOT NULL,
      author_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      created INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_comment_reactions_target ON comment_reactions(target_type, target_id);
  `,
};
