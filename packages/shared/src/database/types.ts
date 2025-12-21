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
  NoteSyncState,
  FolderSyncState,
  ActivityLogState,
  SequenceState,
  CachedProfilePresence,
  ImageCache,
  CommentThreadCache,
  CommentReplyCache,
  CommentReactionCache,
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
   * Run a query that returns the number of changes (INSERT, UPDATE, DELETE)
   */
  run(sql: string, params?: unknown[]): Promise<{ changes: number }>;

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
  getDeletedNotes(sdId?: string): Promise<NoteCache[]>;

  /**
   * Delete a note from the cache
   */
  deleteNote(noteId: UUID): Promise<void>;

  /**
   * Auto-cleanup: Find notes from Recently Deleted that are older than the threshold
   * @param thresholdDays Number of days after which deleted notes should be permanently deleted (default: 30)
   * @returns Array of note IDs that should be permanently deleted
   */
  autoCleanupDeletedNotes(thresholdDays?: number): Promise<UUID[]>;

  /**
   * Get count of non-deleted notes in a specific folder
   * @param sdId Storage directory ID
   * @param folderId Folder ID, or null for root "All Notes"
   * @returns Count of notes
   */
  getNoteCountForFolder(sdId: string, folderId: string | null): Promise<number>;

  /**
   * Get count of all non-deleted notes in a storage directory (for "All Notes")
   * @param sdId Storage directory ID
   * @returns Count of notes
   */
  getAllNotesCount(sdId: string): Promise<number>;

  /**
   * Get count of deleted notes in a storage directory (for "Recently Deleted")
   * @param sdId Storage directory ID
   * @returns Count of deleted notes
   */
  getDeletedNoteCount(sdId: string): Promise<number>;

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
   * Get all tags with note counts
   */
  getAllTags(): Promise<Array<Tag & { count: number }>>;

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
 * Inter-note link operations
 */
export interface LinkOperations {
  /**
   * Add a link from one note to another
   */
  addLink(sourceNoteId: UUID, targetNoteId: UUID): Promise<void>;

  /**
   * Remove a link from one note to another
   */
  removeLink(sourceNoteId: UUID, targetNoteId: UUID): Promise<void>;

  /**
   * Get all links from a note (outgoing links)
   */
  getLinksFromNote(sourceNoteId: UUID): Promise<UUID[]>;

  /**
   * Get all links to a note (incoming links/backlinks)
   */
  getLinksToNote(targetNoteId: UUID): Promise<UUID[]>;

  /**
   * Get all notes that link to a specific note (with full note details)
   */
  getBacklinks(targetNoteId: UUID): Promise<NoteCache[]>;
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
   * Get a storage directory by UUID
   */
  getStorageDirByUuid(uuid: string): Promise<StorageDirCache | null>;

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

  /**
   * Update the path of a storage directory
   */
  updateStorageDirPath(id: string, newPath: string): Promise<void>;

  /**
   * Rename a storage directory
   * @param id Storage directory ID
   * @param newName New name (1-255 chars, will be trimmed)
   * @throws Error if name is empty, too long, or already exists
   */
  updateStorageDirName(id: string, newName: string): Promise<void>;
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
 * Note sync state operations (new append-only log format)
 */
export interface NoteSyncStateOperations {
  /**
   * Get sync state for a note
   */
  getNoteSyncState(noteId: string, sdId: string): Promise<NoteSyncState | null>;

  /**
   * Insert or update sync state for a note
   */
  upsertNoteSyncState(state: NoteSyncState): Promise<void>;

  /**
   * Delete sync state for a note
   */
  deleteNoteSyncState(noteId: string, sdId: string): Promise<void>;

  /**
   * Get all sync states for an SD
   */
  getNoteSyncStatesBySd(sdId: string): Promise<NoteSyncState[]>;

  /**
   * Delete all sync states for an SD
   */
  deleteNoteSyncStatesBySd(sdId: string): Promise<void>;
}

/**
 * Folder sync state operations
 */
export interface FolderSyncStateOperations {
  /**
   * Get sync state for folders in an SD
   */
  getFolderSyncState(sdId: string): Promise<FolderSyncState | null>;

  /**
   * Insert or update folder sync state
   */
  upsertFolderSyncState(state: FolderSyncState): Promise<void>;

  /**
   * Delete folder sync state
   */
  deleteFolderSyncState(sdId: string): Promise<void>;
}

/**
 * Activity log state operations
 */
export interface ActivityLogStateOperations {
  /**
   * Get activity log state for an instance
   */
  getActivityLogState(sdId: string, instanceId: string): Promise<ActivityLogState | null>;

  /**
   * Insert or update activity log state
   */
  upsertActivityLogState(state: ActivityLogState): Promise<void>;

  /**
   * Get all activity log states for an SD
   */
  getActivityLogStatesBySd(sdId: string): Promise<ActivityLogState[]>;

  /**
   * Delete activity log state
   */
  deleteActivityLogState(sdId: string, instanceId: string): Promise<void>;

  /**
   * Delete all activity log states for an SD
   */
  deleteActivityLogStatesBySd(sdId: string): Promise<void>;
}

/**
 * Sequence state operations
 */
export interface SequenceStateOperations {
  /**
   * Get sequence state for a document
   */
  getSequenceState(sdId: string, documentId: string): Promise<SequenceState | null>;

  /**
   * Insert or update sequence state
   */
  upsertSequenceState(state: SequenceState): Promise<void>;

  /**
   * Delete sequence state
   */
  deleteSequenceState(sdId: string, documentId: string): Promise<void>;

  /**
   * Get all sequence states for an SD
   */
  getSequenceStatesBySd(sdId: string): Promise<SequenceState[]>;

  /**
   * Delete all sequence states for an SD
   */
  deleteSequenceStatesBySd(sdId: string): Promise<void>;
}

/**
 * Image cache operations
 * @see plans/add-images/PLAN-PHASE-1.md
 */
export interface ImageCacheOperations {
  /**
   * Insert or update an image in the cache
   */
  upsertImage(image: ImageCache): Promise<void>;

  /**
   * Get an image from the cache by ID
   */
  getImage(imageId: UUID): Promise<ImageCache | null>;

  /**
   * Get all images in a sync directory
   */
  getImagesBySd(sdId: string): Promise<ImageCache[]>;

  /**
   * Delete an image from the cache
   */
  deleteImage(imageId: UUID): Promise<void>;

  /**
   * Check if an image exists in the cache
   */
  imageExists(imageId: UUID): Promise<boolean>;

  /**
   * Get total size of all images in a sync directory
   */
  getImageStorageSize(sdId: string): Promise<number>;

  /**
   * Get count of images in a sync directory
   */
  getImageCount(sdId: string): Promise<number>;
}

/**
 * Profile presence cache operations
 * @see plans/stale-sync-ux/PROFILE-PRESENCE.md
 */
export interface ProfilePresenceCacheOperations {
  /**
   * Get cached presence for a profile in an SD
   */
  getProfilePresenceCache(profileId: string, sdId: string): Promise<CachedProfilePresence | null>;

  /**
   * Get cached presence by instanceId in an SD
   * Used for mapping activity log entries to profile info
   */
  getProfilePresenceCacheByInstanceId(
    instanceId: string,
    sdId: string
  ): Promise<CachedProfilePresence | null>;

  /**
   * Get all cached presence entries for an SD
   */
  getProfilePresenceCacheBySd(sdId: string): Promise<CachedProfilePresence[]>;

  /**
   * Insert or update cached profile presence
   */
  upsertProfilePresenceCache(presence: CachedProfilePresence): Promise<void>;

  /**
   * Delete cached profile presence
   */
  deleteProfilePresenceCache(profileId: string, sdId: string): Promise<void>;

  /**
   * Delete all cached presence for an SD
   */
  deleteProfilePresenceCacheBySd(sdId: string): Promise<void>;
}

/**
 * Comment cache operations
 * @see plans/note-comments/PLAN.md
 */
export interface CommentCacheOperations {
  /**
   * Insert or update a comment thread in the cache
   */
  upsertCommentThread(thread: CommentThreadCache): Promise<void>;

  /**
   * Get a comment thread by ID
   */
  getCommentThread(threadId: UUID): Promise<CommentThreadCache | null>;

  /**
   * Get all comment threads for a note
   */
  getCommentThreadsForNote(noteId: UUID): Promise<CommentThreadCache[]>;

  /**
   * Delete a comment thread from the cache
   */
  deleteCommentThread(threadId: UUID): Promise<void>;

  /**
   * Delete all comment threads for a note
   */
  deleteCommentThreadsForNote(noteId: UUID): Promise<void>;

  /**
   * Insert or update a comment reply in the cache
   */
  upsertCommentReply(reply: CommentReplyCache): Promise<void>;

  /**
   * Get a comment reply by ID
   */
  getCommentReply(replyId: UUID): Promise<CommentReplyCache | null>;

  /**
   * Get all replies for a thread
   */
  getRepliesForThread(threadId: UUID): Promise<CommentReplyCache[]>;

  /**
   * Delete a comment reply from the cache
   */
  deleteCommentReply(replyId: UUID): Promise<void>;

  /**
   * Delete all replies for a thread
   */
  deleteRepliesForThread(threadId: UUID): Promise<void>;

  /**
   * Insert or update a comment reaction in the cache
   */
  upsertCommentReaction(reaction: CommentReactionCache): Promise<void>;

  /**
   * Get a comment reaction by ID
   */
  getCommentReaction(reactionId: UUID): Promise<CommentReactionCache | null>;

  /**
   * Get all reactions for a target (thread or reply)
   */
  getReactionsForTarget(
    targetType: 'thread' | 'reply',
    targetId: UUID
  ): Promise<CommentReactionCache[]>;

  /**
   * Delete a comment reaction from the cache
   */
  deleteCommentReaction(reactionId: UUID): Promise<void>;

  /**
   * Delete all reactions for a target
   */
  deleteReactionsForTarget(targetType: 'thread' | 'reply', targetId: UUID): Promise<void>;
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
  extends
    NoteCacheOperations,
    FolderCacheOperations,
    TagOperations,
    LinkOperations,
    AppStateOperations,
    UserOperations,
    StorageDirOperations,
    SchemaVersionOperations,
    NoteSyncStateOperations,
    FolderSyncStateOperations,
    ProfilePresenceCacheOperations,
    ImageCacheOperations,
    CommentCacheOperations {
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

  /**
   * Clean up orphaned data (notes, folders, tags from deleted SDs)
   */
  cleanupOrphanedData(): Promise<{
    notesDeleted: number;
    foldersDeleted: number;
    tagAssociationsDeleted: number;
    unusedTagsDeleted: number;
  }>;

  /**
   * Reindex all notes in the FTS5 full-text search index.
   * This is useful after changes to the indexing logic (e.g., hashtag transformation).
   * @param onProgress Optional callback for progress updates (current, total)
   */
  reindexNotes(onProgress?: (current: number, total: number) => void): Promise<void>;
}
