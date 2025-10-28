/**
 * Database abstraction types
 * Platform-specific implementations (Node.js with better-sqlite3, iOS with GRDB)
 * must implement these interfaces
 */

import type {
  NoteCache,
  FolderCache,
  Tag,
  User,
  AppState,
  SearchResult,
  SchemaVersionRecord,
  StorageDirCache,
} from './schema';
import type { UUID } from '../types';

/**
 * Database adapter interface
 * Abstracts SQLite operations for platform independence
 */
export interface DatabaseAdapter {
  /**
   * Initialize database and create schema
   */
  initialize(): Promise<void>;

  /**
   * Close database connection
   */
  close(): Promise<void>;

  /**
   * Run a query that doesn't return data (INSERT, UPDATE, DELETE)
   */
  exec(sql: string, params?: unknown[]): Promise<void>;

  /**
   * Run a query that returns a single row
   */
  get<T>(sql: string, params?: unknown[]): Promise<T | null>;

  /**
   * Run a query that returns multiple rows
   */
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;

  /**
   * Begin a transaction
   */
  beginTransaction(): Promise<void>;

  /**
   * Commit a transaction
   */
  commit(): Promise<void>;

  /**
   * Rollback a transaction
   */
  rollback(): Promise<void>;
}

/**
 * Note cache operations
 */
export interface NoteCacheOperations {
  /**
   * Insert or update a note in the cache
   */
  upsertNote(note: NoteCache): Promise<void>;

  /**
   * Get a note from the cache
   */
  getNote(noteId: UUID): Promise<NoteCache | null>;

  /**
   * Get all notes in a folder
   */
  getNotesByFolder(folderId: UUID | null): Promise<NoteCache[]>;

  /**
   * Get all notes in an SD
   */
  getNotesBySd(sdId: string): Promise<NoteCache[]>;

  /**
   * Get all non-deleted notes
   */
  getActiveNotes(): Promise<NoteCache[]>;

  /**
   * Get all deleted notes (for "Recently Deleted")
   */
  getDeletedNotes(): Promise<NoteCache[]>;

  /**
   * Delete a note from the cache
   */
  deleteNote(noteId: UUID): Promise<void>;

  /**
   * Full-text search notes
   */
  searchNotes(query: string, limit?: number): Promise<SearchResult[]>;
}

/**
 * Folder cache operations
 */
export interface FolderCacheOperations {
  /**
   * Insert or update a folder in the cache
   */
  upsertFolder(folder: FolderCache): Promise<void>;

  /**
   * Get a folder from the cache
   */
  getFolder(folderId: UUID): Promise<FolderCache | null>;

  /**
   * Get all folders in an SD
   */
  getFoldersBySd(sdId: string): Promise<FolderCache[]>;

  /**
   * Get root folders (parentId is null)
   */
  getRootFolders(sdId: string): Promise<FolderCache[]>;

  /**
   * Get child folders of a parent
   */
  getChildFolders(parentId: UUID): Promise<FolderCache[]>;

  /**
   * Delete a folder from the cache
   */
  deleteFolder(folderId: UUID): Promise<void>;
}

/**
 * Tag operations
 */
export interface TagOperations {
  /**
   * Create a tag (or get existing by name)
   */
  createTag(name: string): Promise<Tag>;

  /**
   * Get a tag by ID
   */
  getTag(tagId: UUID): Promise<Tag | null>;

  /**
   * Get a tag by name (case-insensitive)
   */
  getTagByName(name: string): Promise<Tag | null>;

  /**
   * Get all tags
   */
  getAllTags(): Promise<Tag[]>;

  /**
   * Get tags for a note
   */
  getTagsForNote(noteId: UUID): Promise<Tag[]>;

  /**
   * Add a tag to a note
   */
  addTagToNote(noteId: UUID, tagId: UUID): Promise<void>;

  /**
   * Remove a tag from a note
   */
  removeTagFromNote(noteId: UUID, tagId: UUID): Promise<void>;

  /**
   * Get notes with a specific tag
   */
  getNotesWithTag(tagId: UUID): Promise<NoteCache[]>;

  /**
   * Delete a tag
   */
  deleteTag(tagId: UUID): Promise<void>;
}

/**
 * App state operations
 */
export interface AppStateOperations {
  /**
   * Get app state value
   */
  getState(key: string): Promise<string | null>;

  /**
   * Set app state value
   */
  setState(key: string, value: string): Promise<void>;

  /**
   * Delete app state value
   */
  deleteState(key: string): Promise<void>;

  /**
   * Get all app state
   */
  getAllState(): Promise<AppState[]>;
}

/**
 * User operations
 */
export interface UserOperations {
  /**
   * Upsert a user
   */
  upsertUser(user: User): Promise<void>;

  /**
   * Get a user by ID
   */
  getUser(userId: UUID): Promise<User | null>;

  /**
   * Get all users
   */
  getAllUsers(): Promise<User[]>;
}

/**
 * Storage Directory operations
 */
export interface StorageDirOperations {
  /**
   * Create a new storage directory
   */
  createStorageDir(id: string, name: string, path: string): Promise<StorageDirCache>;

  /**
   * Get a storage directory by ID
   */
  getStorageDir(id: string): Promise<StorageDirCache | null>;

  /**
   * Get all storage directories
   */
  getAllStorageDirs(): Promise<StorageDirCache[]>;

  /**
   * Get the active storage directory
   */
  getActiveStorageDir(): Promise<StorageDirCache | null>;

  /**
   * Set the active storage directory (only one can be active)
   */
  setActiveStorageDir(id: string): Promise<void>;

  /**
   * Delete a storage directory
   */
  deleteStorageDir(id: string): Promise<void>;
}

/**
 * Schema version operations
 */
export interface SchemaVersionOperations {
  /**
   * Get current schema version
   */
  getCurrentVersion(): Promise<number | null>;

  /**
   * Get all version records (migration history)
   */
  getVersionHistory(): Promise<SchemaVersionRecord[]>;

  /**
   * Record a schema version
   */
  recordVersion(version: number, description: string): Promise<void>;
}

/**
 * Migration result
 */
export enum MigrationResult {
  /** Schema is up to date, no action needed */
  UpToDate = 'up-to-date',
  /** Cache tables rebuilt from CRDT */
  CacheRebuilt = 'cache-rebuilt',
  /** User data migrated to new version */
  Migrated = 'migrated',
  /** Database was incompatible, full rebuild required */
  FullRebuild = 'full-rebuild',
}

/**
 * Complete database interface
 */
export interface Database
  extends NoteCacheOperations,
    FolderCacheOperations,
    TagOperations,
    AppStateOperations,
    UserOperations,
    StorageDirOperations,
    SchemaVersionOperations {
  /**
   * Get the underlying adapter
   */
  getAdapter(): DatabaseAdapter;

  /**
   * Initialize the database
   */
  initialize(): Promise<void>;

  /**
   * Close the database
   */
  close(): Promise<void>;

  /**
   * Run operations in a transaction
   */
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}
