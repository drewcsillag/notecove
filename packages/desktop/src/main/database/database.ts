/**
 * SQLite Database Implementation
 *
 * Implements the Database interface using better-sqlite3 adapter.
 * Provides all CRUD operations for notes, folders, tags, app state, and users.
 */

import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type {
  Database,
  DatabaseAdapter,
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
  CachedProfilePresence,
  ImageCache,
  CommentThreadCache,
  CommentReplyCache,
  CommentReactionCache,
} from '@notecove/shared';
import { SCHEMA_SQL, SCHEMA_VERSION, SdUuidManager } from '@notecove/shared';
import type { UUID, FileSystemAdapter, FileStats } from '@notecove/shared';

/**
 * Node.js implementation of FileSystemAdapter for SD UUID management
 */
class NodeFsAdapter implements FileSystemAdapter {
  async exists(filepath: string): Promise<boolean> {
    try {
      await fs.promises.access(filepath);
      return true;
    } catch {
      return false;
    }
  }

  async mkdir(dirpath: string): Promise<void> {
    await fs.promises.mkdir(dirpath, { recursive: true });
  }

  async readFile(filepath: string): Promise<Uint8Array> {
    return await fs.promises.readFile(filepath);
  }

  async writeFile(filepath: string, data: Uint8Array): Promise<void> {
    await fs.promises.writeFile(filepath, data);
  }

  async deleteFile(filepath: string): Promise<void> {
    await fs.promises.unlink(filepath);
  }

  async listFiles(dirpath: string): Promise<string[]> {
    return await fs.promises.readdir(dirpath);
  }

  joinPath(...segments: string[]): string {
    return path.join(...segments);
  }

  basename(filepath: string): string {
    return path.basename(filepath);
  }

  async stat(filepath: string): Promise<FileStats> {
    const stats = await fs.promises.stat(filepath);
    return {
      size: stats.size,
      mtimeMs: stats.mtimeMs,
      ctimeMs: stats.ctimeMs,
    };
  }

  async appendFile(filepath: string, data: Uint8Array): Promise<void> {
    await fs.promises.appendFile(filepath, data);
  }
}

export class SqliteDatabase implements Database {
  constructor(private readonly adapter: DatabaseAdapter) {}

  getAdapter(): DatabaseAdapter {
    return this.adapter;
  }

  async initialize(): Promise<void> {
    await this.adapter.initialize();
    await this.createSchema();
    await this.ensureSchemaVersion();
  }

  async close(): Promise<void> {
    await this.adapter.close();
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    await this.adapter.beginTransaction();
    try {
      const result = await fn();
      await this.adapter.commit();
      return result;
    } catch (error) {
      await this.adapter.rollback();
      throw error;
    }
  }

  /**
   * Create database schema
   */
  private async createSchema(): Promise<void> {
    // Create tables in order (respecting foreign keys)
    await this.adapter.exec(SCHEMA_SQL.version);
    await this.adapter.exec(SCHEMA_SQL.storageDirs);
    await this.adapter.exec(SCHEMA_SQL.noteMoves);
    await this.adapter.exec(SCHEMA_SQL.notes);

    // Create FTS5 table without external content for simplicity
    // This stores its own copy of the data
    await this.adapter.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
        note_id UNINDEXED,
        title,
        content
      );
    `);

    // Triggers to keep FTS index in sync
    // Use transform_hashtags() to convert #tag to __hashtag__tag for proper hashtag search
    await this.adapter.exec(`
      CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
        INSERT INTO notes_fts(note_id, title, content)
        VALUES (new.id, transform_hashtags(new.title), transform_hashtags(new.content_text));
      END;
    `);

    await this.adapter.exec(`
      CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
        DELETE FROM notes_fts WHERE note_id = old.id;
      END;
    `);

    await this.adapter.exec(`
      CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
        UPDATE notes_fts SET title = transform_hashtags(new.title), content = transform_hashtags(new.content_text)
        WHERE note_id = new.id;
      END;
    `);

    await this.adapter.exec(SCHEMA_SQL.folders);
    await this.adapter.exec(SCHEMA_SQL.tags);
    await this.adapter.exec(SCHEMA_SQL.noteTags);
    await this.adapter.exec(SCHEMA_SQL.noteLinks);
    await this.adapter.exec(SCHEMA_SQL.checkboxes);
    await this.adapter.exec(SCHEMA_SQL.users);
    await this.adapter.exec(SCHEMA_SQL.appState);

    // New tables for append-only log storage format (v6)
    await this.adapter.exec(SCHEMA_SQL.noteSyncState);
    await this.adapter.exec(SCHEMA_SQL.folderSyncState);
    await this.adapter.exec(SCHEMA_SQL.activityLogState);
    await this.adapter.exec(SCHEMA_SQL.sequenceState);

    // Profile presence cache for Stale Sync UI
    await this.adapter.exec(SCHEMA_SQL.profilePresenceCache);

    // Images table for image metadata (v8)
    await this.adapter.exec(SCHEMA_SQL.images);

    // Comment tables for note comments (v9)
    await this.adapter.exec(SCHEMA_SQL.commentThreads);
    await this.adapter.exec(SCHEMA_SQL.commentReplies);
    await this.adapter.exec(SCHEMA_SQL.commentReactions);
  }

  /**
   * Ensure schema version is current
   */
  private async ensureSchemaVersion(): Promise<void> {
    const currentVersion = await this.getCurrentVersion();

    if (currentVersion === null) {
      // First time setup - run all migrations to ensure indexes etc are created
      // Migrations are idempotent so this is safe
      await this.runMigrations(0);
      await this.recordVersion(SCHEMA_VERSION, 'Initial schema');
    } else if (currentVersion < SCHEMA_VERSION) {
      // Run migrations sequentially
      await this.runMigrations(currentVersion);
    }
  }

  /**
   * Run migrations from currentVersion to SCHEMA_VERSION
   */
  private async runMigrations(fromVersion: number): Promise<void> {
    console.log(`[Database] Running migrations from v${fromVersion} to v${SCHEMA_VERSION}`);

    // Migration v6 -> v7: Add instance_id column to profile_presence_cache
    if (fromVersion < 7) {
      await this.migrateToVersion7();
    }

    // Migration v7 -> v8: Add images table
    if (fromVersion < 8) {
      await this.migrateToVersion8();
    }

    // Migration v8 -> v9: Add comment tables
    if (fromVersion < 9) {
      await this.migrateToVersion9();
    }

    // Add future migrations here following the pattern:
    // if (fromVersion < N) { await this.migrateToVersionN(); }
  }

  /**
   * Migration to version 7:
   * - Add instance_id column to profile_presence_cache table
   * - Add index on (instance_id, sd_id) for efficient lookups
   */
  private async migrateToVersion7(): Promise<void> {
    console.log('[Database] Migrating to v7: Adding instance_id to profile_presence_cache');

    // Check if the column already exists (idempotent migration)
    const tableInfo = await this.adapter.all<{ name: string }>(
      "PRAGMA table_info('profile_presence_cache')"
    );
    const hasInstanceId = tableInfo.some((col) => col.name === 'instance_id');

    if (!hasInstanceId) {
      // Add the instance_id column
      await this.adapter.exec('ALTER TABLE profile_presence_cache ADD COLUMN instance_id TEXT');
      console.log('[Database] Added instance_id column to profile_presence_cache');
    }

    // Create the index if it doesn't exist (CREATE INDEX IF NOT EXISTS is safe)
    await this.adapter.exec(
      'CREATE INDEX IF NOT EXISTS idx_profile_presence_cache_instance_id ON profile_presence_cache(instance_id, sd_id)'
    );
    console.log('[Database] Created/verified idx_profile_presence_cache_instance_id index');

    // Record the migration
    await this.recordVersion(7, 'Added instance_id column and index to profile_presence_cache');
    console.log('[Database] Migration to v7 complete');
  }

  /**
   * Migration to version 8:
   * - Add images table for image metadata caching
   */
  private async migrateToVersion8(): Promise<void> {
    console.log('[Database] Migrating to v8: Adding images table');

    // Create the images table (CREATE TABLE IF NOT EXISTS is safe)
    await this.adapter.exec(SCHEMA_SQL.images);
    console.log('[Database] Created/verified images table');

    // Record the migration
    await this.recordVersion(8, 'Added images table for image metadata');
    console.log('[Database] Migration to v8 complete');
  }

  /**
   * Migration to version 9:
   * - Add comment_threads, comment_replies, comment_reactions tables for note comments
   */
  private async migrateToVersion9(): Promise<void> {
    console.log('[Database] Migrating to v9: Adding comment tables');

    // Create the comment tables (CREATE TABLE IF NOT EXISTS is safe)
    await this.adapter.exec(SCHEMA_SQL.commentThreads);
    console.log('[Database] Created/verified comment_threads table');

    await this.adapter.exec(SCHEMA_SQL.commentReplies);
    console.log('[Database] Created/verified comment_replies table');

    await this.adapter.exec(SCHEMA_SQL.commentReactions);
    console.log('[Database] Created/verified comment_reactions table');

    // Record the migration
    await this.recordVersion(9, 'Added comment tables for note comments');
    console.log('[Database] Migration to v9 complete');
  }

  // ============================================================================
  // Note Cache Operations
  // ============================================================================

  async upsertNote(note: NoteCache): Promise<void> {
    await this.adapter.exec(
      `INSERT INTO notes (id, title, sd_id, folder_id, created, modified, deleted, pinned, content_preview, content_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         sd_id = excluded.sd_id,
         folder_id = excluded.folder_id,
         created = excluded.created,
         modified = excluded.modified,
         deleted = excluded.deleted,
         pinned = excluded.pinned,
         content_preview = excluded.content_preview,
         content_text = excluded.content_text`,
      [
        note.id,
        note.title,
        note.sdId,
        note.folderId,
        note.created,
        note.modified,
        note.deleted ? 1 : 0,
        note.pinned ? 1 : 0,
        note.contentPreview,
        note.contentText,
      ]
    );
  }

  async getNote(noteId: UUID): Promise<NoteCache | null> {
    const row = await this.adapter.get<{
      id: string;
      title: string;
      sd_id: string;
      folder_id: string | null;
      created: number;
      modified: number;
      deleted: number;
      pinned: number;
      content_preview: string;
      content_text: string;
    }>('SELECT * FROM notes WHERE id = ?', [noteId]);

    return row ? this.mapNoteRow(row) : null;
  }

  async getNotesByFolder(folderId: UUID | null): Promise<NoteCache[]> {
    const rows = await this.adapter.all<{
      id: string;
      title: string;
      sd_id: string;
      folder_id: string | null;
      created: number;
      modified: number;
      deleted: number;
      pinned: number;
      content_preview: string;
      content_text: string;
    }>(
      folderId === null
        ? 'SELECT * FROM notes WHERE folder_id IS NULL AND deleted = 0 ORDER BY modified DESC'
        : 'SELECT * FROM notes WHERE folder_id = ? AND deleted = 0 ORDER BY modified DESC',
      folderId === null ? [] : [folderId]
    );

    return rows.map((row) => this.mapNoteRow(row));
  }

  async getNotesBySd(sdId: string): Promise<NoteCache[]> {
    const rows = await this.adapter.all<{
      id: string;
      title: string;
      sd_id: string;
      folder_id: string | null;
      created: number;
      modified: number;
      deleted: number;
      pinned: number;
      content_preview: string;
      content_text: string;
    }>('SELECT * FROM notes WHERE sd_id = ? AND deleted = 0 ORDER BY modified DESC', [sdId]);

    return rows.map((row) => this.mapNoteRow(row));
  }

  async getActiveNotes(): Promise<NoteCache[]> {
    const rows = await this.adapter.all<{
      id: string;
      title: string;
      sd_id: string;
      folder_id: string | null;
      created: number;
      modified: number;
      deleted: number;
      pinned: number;
      content_preview: string;
      content_text: string;
    }>('SELECT * FROM notes WHERE deleted = 0 ORDER BY modified DESC');

    return rows.map((row) => this.mapNoteRow(row));
  }

  async getDeletedNotes(sdId?: string): Promise<NoteCache[]> {
    const rows = await this.adapter.all<{
      id: string;
      title: string;
      sd_id: string;
      folder_id: string | null;
      created: number;
      modified: number;
      deleted: number;
      pinned: number;
      content_preview: string;
      content_text: string;
    }>(
      sdId
        ? 'SELECT * FROM notes WHERE deleted = 1 AND sd_id = ? ORDER BY modified DESC'
        : 'SELECT * FROM notes WHERE deleted = 1 ORDER BY modified DESC',
      sdId ? [sdId] : []
    );

    return rows.map((row) => this.mapNoteRow(row));
  }

  async deleteNote(noteId: UUID): Promise<void> {
    await this.adapter.exec('DELETE FROM notes WHERE id = ?', [noteId]);
  }

  /**
   * Auto-cleanup: Find notes from Recently Deleted that are older than the threshold
   * @param thresholdDays Number of days after which deleted notes should be permanently deleted (default: 30)
   * @returns Array of note IDs that should be permanently deleted
   */
  async autoCleanupDeletedNotes(thresholdDays = 30): Promise<UUID[]> {
    const cutoffTimestamp = Date.now() - thresholdDays * 24 * 60 * 60 * 1000;

    // Find notes that are deleted and older than the threshold
    const rows = await this.adapter.all<{ id: string }>(
      'SELECT id FROM notes WHERE deleted = 1 AND modified < ?',
      [cutoffTimestamp]
    );

    const noteIds = rows.map((row) => row.id);
    return noteIds;
  }

  /**
   * Get count of non-deleted notes in a specific folder
   * @param sdId Storage directory ID
   * @param folderId Folder ID, or null for root "All Notes"
   * @returns Count of notes
   */
  async getNoteCountForFolder(sdId: string, folderId: string | null): Promise<number> {
    const row = await this.adapter.get<{ count: number }>(
      folderId === null
        ? 'SELECT COUNT(*) as count FROM notes WHERE sd_id = ? AND folder_id IS NULL AND deleted = 0'
        : 'SELECT COUNT(*) as count FROM notes WHERE sd_id = ? AND folder_id = ? AND deleted = 0',
      folderId === null ? [sdId] : [sdId, folderId]
    );

    return row?.count ?? 0;
  }

  /**
   * Get count of all non-deleted notes in a storage directory (for "All Notes")
   * @param sdId Storage directory ID
   * @returns Count of notes
   */
  async getAllNotesCount(sdId: string): Promise<number> {
    const row = await this.adapter.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM notes WHERE sd_id = ? AND deleted = 0',
      [sdId]
    );

    return row?.count ?? 0;
  }

  /**
   * Get count of deleted notes in a storage directory (for "Recently Deleted")
   * @param sdId Storage directory ID
   * @returns Count of deleted notes
   */
  async getDeletedNoteCount(sdId: string): Promise<number> {
    const row = await this.adapter.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM notes WHERE sd_id = ? AND deleted = 1',
      [sdId]
    );

    return row?.count ?? 0;
  }

  async searchNotes(query: string, limit = 50): Promise<SearchResult[]> {
    // First, transform hashtags in the query to match the indexed format
    // e.g., "#work" becomes "__hashtag__work"
    const hashtagTransformedQuery = query.replace(/#(\w+)/g, '__hashtag__$1');

    // FTS5 special characters that need to be quoted (excluding # which is now transformed)
    // These characters have special meaning in FTS5 query syntax
    const fts5SpecialChars = /[@:^$(){}[\]\\|!&~<>]/;

    // Transform query to support prefix matching
    // For each word >=3 chars, add wildcard for prefix search
    const fts5Query = hashtagTransformedQuery
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0)
      .map((word) => {
        // If it's already a quoted phrase, keep it as is
        if (word.startsWith('"') && word.endsWith('"')) {
          return word;
        }
        // If it contains special characters, quote it for exact match
        if (fts5SpecialChars.test(word)) {
          // Escape any internal quotes and wrap in quotes
          const escaped = word.replace(/"/g, '""');
          return `"${escaped}"`;
        }
        // For words >= 3 chars, add prefix wildcard
        if (word.length >= 3) {
          return `${word}*`;
        }
        // Shorter words: exact match only
        return word;
      })
      .join(' ');

    const rows = await this.adapter.all<{
      note_id: string;
      title: string;
      content: string;
      rank: number;
    }>(
      `SELECT
        notes_fts.note_id,
        notes_fts.title,
        snippet(notes_fts, 2, '', '', '...', 32) as content,
        notes_fts.rank
      FROM notes_fts
      INNER JOIN notes ON notes_fts.note_id = notes.id
      WHERE notes_fts MATCH ? AND notes.deleted = 0
      ORDER BY notes_fts.rank
      LIMIT ?`,
      [fts5Query, limit]
    );

    return rows.map((row) => ({
      noteId: row.note_id,
      title: row.title,
      snippet: row.content,
      rank: row.rank,
    }));
  }

  /**
   * Reindex all notes in the FTS5 full-text search index.
   * This is useful after changes to the indexing logic (e.g., hashtag transformation).
   * @param onProgress Optional callback for progress updates (current, total)
   */
  async reindexNotes(onProgress?: (current: number, total: number) => void): Promise<void> {
    // Get all notes (including deleted ones, so they're searchable if restored)
    const rows = await this.adapter.all<{
      id: string;
      title: string;
      content_text: string;
    }>('SELECT id, title, content_text FROM notes');

    const total = rows.length;
    if (total === 0) {
      onProgress?.(0, 0);
      return;
    }

    // Clear the FTS index
    await this.adapter.exec('DELETE FROM notes_fts');

    // Re-insert all notes with transformed hashtags
    // The trigger won't fire since we're inserting directly into notes_fts,
    // so we need to apply transform_hashtags ourselves
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      await this.adapter.exec(
        'INSERT INTO notes_fts(note_id, title, content) VALUES (?, transform_hashtags(?), transform_hashtags(?))',
        [row.id, row.title, row.content_text]
      );
      onProgress?.(i + 1, total);
    }
  }

  private mapNoteRow(row: {
    id: string;
    title: string;
    sd_id: string;
    folder_id: string | null;
    created: number;
    modified: number;
    deleted: number;
    pinned: number;
    content_preview: string;
    content_text: string;
  }): NoteCache {
    return {
      id: row.id,
      title: row.title,
      sdId: row.sd_id,
      folderId: row.folder_id,
      created: row.created,
      modified: row.modified,
      deleted: row.deleted === 1,
      pinned: row.pinned === 1,
      contentPreview: row.content_preview,
      contentText: row.content_text,
    };
  }

  // ============================================================================
  // Folder Cache Operations
  // ============================================================================

  async upsertFolder(folder: FolderCache): Promise<void> {
    await this.adapter.exec(
      `INSERT INTO folders (id, name, parent_id, sd_id, "order", deleted)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         parent_id = excluded.parent_id,
         sd_id = excluded.sd_id,
         "order" = excluded."order",
         deleted = excluded.deleted`,
      [folder.id, folder.name, folder.parentId, folder.sdId, folder.order, folder.deleted ? 1 : 0]
    );
  }

  async getFolder(folderId: UUID): Promise<FolderCache | null> {
    const row = await this.adapter.get<{
      id: string;
      name: string;
      parent_id: string | null;
      sd_id: string;
      order: number;
      deleted: number;
    }>('SELECT * FROM folders WHERE id = ?', [folderId]);

    return row ? this.mapFolderRow(row) : null;
  }

  async getFoldersBySd(sdId: string): Promise<FolderCache[]> {
    const rows = await this.adapter.all<{
      id: string;
      name: string;
      parent_id: string | null;
      sd_id: string;
      order: number;
      deleted: number;
    }>('SELECT * FROM folders WHERE sd_id = ? AND deleted = 0 ORDER BY "order"', [sdId]);

    return rows.map((row) => this.mapFolderRow(row));
  }

  async getRootFolders(sdId: string): Promise<FolderCache[]> {
    const rows = await this.adapter.all<{
      id: string;
      name: string;
      parent_id: string | null;
      sd_id: string;
      order: number;
      deleted: number;
    }>(
      'SELECT * FROM folders WHERE sd_id = ? AND parent_id IS NULL AND deleted = 0 ORDER BY "order"',
      [sdId]
    );

    return rows.map((row) => this.mapFolderRow(row));
  }

  async getChildFolders(parentId: UUID): Promise<FolderCache[]> {
    const rows = await this.adapter.all<{
      id: string;
      name: string;
      parent_id: string | null;
      sd_id: string;
      order: number;
      deleted: number;
    }>('SELECT * FROM folders WHERE parent_id = ? AND deleted = 0 ORDER BY "order"', [parentId]);

    return rows.map((row) => this.mapFolderRow(row));
  }

  async deleteFolder(folderId: UUID): Promise<void> {
    await this.adapter.exec('DELETE FROM folders WHERE id = ?', [folderId]);
  }

  private mapFolderRow(row: {
    id: string;
    name: string;
    parent_id: string | null;
    sd_id: string;
    order: number;
    deleted: number;
  }): FolderCache {
    return {
      id: row.id,
      name: row.name,
      parentId: row.parent_id,
      sdId: row.sd_id,
      order: row.order,
      deleted: row.deleted === 1,
    };
  }

  // ============================================================================
  // Tag Operations
  // ============================================================================

  async createTag(name: string): Promise<Tag> {
    // Try to get existing tag first (case-insensitive)
    const existing = await this.getTagByName(name);
    if (existing) {
      return existing;
    }

    // Generate UUID for new tag
    const id = randomUUID() as UUID;
    await this.adapter.exec('INSERT INTO tags (id, name) VALUES (?, ?)', [id, name]);

    return { id, name };
  }

  async getTag(tagId: UUID): Promise<Tag | null> {
    const row = await this.adapter.get<{ id: string; name: string }>(
      'SELECT * FROM tags WHERE id = ?',
      [tagId]
    );

    return row ? { id: row.id, name: row.name } : null;
  }

  async getTagByName(name: string): Promise<Tag | null> {
    const row = await this.adapter.get<{ id: string; name: string }>(
      'SELECT * FROM tags WHERE name = ? COLLATE NOCASE',
      [name]
    );

    return row ? { id: row.id, name: row.name } : null;
  }

  async getAllTags(): Promise<(Tag & { count: number })[]> {
    const rows = await this.adapter.all<{ id: string; name: string; count: number }>(
      `SELECT t.id, t.name, COUNT(nt.note_id) as count
       FROM tags t
       LEFT JOIN note_tags nt ON t.id = nt.tag_id
       GROUP BY t.id, t.name
       HAVING count > 0
       ORDER BY t.name COLLATE NOCASE`
    );

    return rows;
  }

  async getTagsForNote(noteId: UUID): Promise<Tag[]> {
    const rows = await this.adapter.all<{ id: string; name: string }>(
      `SELECT t.id, t.name FROM tags t
       INNER JOIN note_tags nt ON t.id = nt.tag_id
       WHERE nt.note_id = ?
       ORDER BY t.name COLLATE NOCASE`,
      [noteId]
    );

    return rows.map((row) => ({ id: row.id, name: row.name }));
  }

  async addTagToNote(noteId: UUID, tagId: UUID): Promise<void> {
    await this.adapter.exec('INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)', [
      noteId,
      tagId,
    ]);
  }

  async removeTagFromNote(noteId: UUID, tagId: UUID): Promise<void> {
    await this.adapter.exec('DELETE FROM note_tags WHERE note_id = ? AND tag_id = ?', [
      noteId,
      tagId,
    ]);
  }

  async getNotesWithTag(tagId: UUID): Promise<NoteCache[]> {
    const rows = await this.adapter.all<{
      id: string;
      title: string;
      sd_id: string;
      folder_id: string | null;
      created: number;
      modified: number;
      deleted: number;
      pinned: number;
      content_preview: string;
      content_text: string;
    }>(
      `SELECT n.* FROM notes n
       INNER JOIN note_tags nt ON n.id = nt.note_id
       WHERE nt.tag_id = ? AND n.deleted = 0
       ORDER BY n.modified DESC`,
      [tagId]
    );

    return rows.map((row) => this.mapNoteRow(row));
  }

  async deleteTag(tagId: UUID): Promise<void> {
    await this.adapter.exec('DELETE FROM tags WHERE id = ?', [tagId]);
  }

  // ============================================================================
  // Inter-Note Link Operations
  // ============================================================================

  /**
   * Add a link from source note to target note
   * @param sourceNoteId Note containing the link
   * @param targetNoteId Note being linked to
   */
  async addLink(sourceNoteId: UUID, targetNoteId: UUID): Promise<void> {
    await this.adapter.exec(
      'INSERT OR IGNORE INTO note_links (source_note_id, target_note_id) VALUES (?, ?)',
      [sourceNoteId, targetNoteId]
    );
  }

  /**
   * Remove a link from source note to target note
   * @param sourceNoteId Note containing the link
   * @param targetNoteId Note being linked to
   */
  async removeLink(sourceNoteId: UUID, targetNoteId: UUID): Promise<void> {
    await this.adapter.exec(
      'DELETE FROM note_links WHERE source_note_id = ? AND target_note_id = ?',
      [sourceNoteId, targetNoteId]
    );
  }

  /**
   * Get all links from a specific note (outgoing links)
   * @param sourceNoteId Note to get links from
   * @returns Array of target note IDs
   */
  async getLinksFromNote(sourceNoteId: UUID): Promise<UUID[]> {
    const rows = await this.adapter.all<{ target_note_id: string }>(
      'SELECT target_note_id FROM note_links WHERE source_note_id = ?',
      [sourceNoteId]
    );

    return rows.map((row) => row.target_note_id);
  }

  /**
   * Get all links to a specific note (incoming links/backlinks)
   * @param targetNoteId Note to get backlinks to
   * @returns Array of source note IDs
   */
  async getLinksToNote(targetNoteId: UUID): Promise<UUID[]> {
    const rows = await this.adapter.all<{ source_note_id: string }>(
      'SELECT source_note_id FROM note_links WHERE target_note_id = ?',
      [targetNoteId]
    );

    return rows.map((row) => row.source_note_id);
  }

  /**
   * Get all notes that link to a specific note (with full note details)
   * @param targetNoteId Note to get backlinks to
   * @returns Array of note cache entries
   */
  async getBacklinks(targetNoteId: UUID): Promise<NoteCache[]> {
    const rows = await this.adapter.all<{
      id: string;
      title: string;
      sd_id: string;
      folder_id: string | null;
      created: number;
      modified: number;
      deleted: number;
      pinned: number;
      content_preview: string;
      content_text: string;
    }>(
      `SELECT n.* FROM notes n
       INNER JOIN note_links nl ON n.id = nl.source_note_id
       WHERE nl.target_note_id = ? AND n.deleted = 0
       ORDER BY n.modified DESC`,
      [targetNoteId]
    );

    return rows.map((row) => this.mapNoteRow(row));
  }

  /**
   * Remove all links from a note (useful when deleting a note)
   * @param noteId Note to remove all links from
   */
  async removeAllLinksFromNote(noteId: UUID): Promise<void> {
    await this.adapter.exec('DELETE FROM note_links WHERE source_note_id = ?', [noteId]);
  }

  /**
   * Remove all links to a note (useful when deleting a note)
   * @param noteId Note to remove all links to
   */
  async removeAllLinksToNote(noteId: UUID): Promise<void> {
    await this.adapter.exec('DELETE FROM note_links WHERE target_note_id = ?', [noteId]);
  }

  // ============================================================================
  // App State Operations
  // ============================================================================

  async getState(key: string): Promise<string | null> {
    const row = await this.adapter.get<{ value: string }>(
      'SELECT value FROM app_state WHERE key = ?',
      [key]
    );

    return row?.value ?? null;
  }

  async setState(key: string, value: string): Promise<void> {
    await this.adapter.exec(
      'INSERT INTO app_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, value]
    );
  }

  async deleteState(key: string): Promise<void> {
    await this.adapter.exec('DELETE FROM app_state WHERE key = ?', [key]);
  }

  async getAllState(): Promise<AppState[]> {
    const rows = await this.adapter.all<{ key: string; value: string }>('SELECT * FROM app_state');

    return rows.map((row) => ({ key: row.key, value: row.value }));
  }

  // ============================================================================
  // User Operations
  // ============================================================================

  async upsertUser(user: User): Promise<void> {
    await this.adapter.exec(
      `INSERT INTO users (id, username, last_seen)
       VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         username = excluded.username,
         last_seen = excluded.last_seen`,
      [user.id, user.username, user.lastSeen]
    );
  }

  async getUser(userId: UUID): Promise<User | null> {
    const row = await this.adapter.get<{
      id: string;
      username: string;
      last_seen: number;
    }>('SELECT * FROM users WHERE id = ?', [userId]);

    return row ? { id: row.id, username: row.username, lastSeen: row.last_seen } : null;
  }

  async getAllUsers(): Promise<User[]> {
    const rows = await this.adapter.all<{
      id: string;
      username: string;
      last_seen: number;
    }>('SELECT * FROM users ORDER BY last_seen DESC');

    return rows.map((row) => ({
      id: row.id,
      username: row.username,
      lastSeen: row.last_seen,
    }));
  }

  // ============================================================================
  // Storage Directory Operations
  // ============================================================================

  async createStorageDir(id: string, name: string, sdPath: string): Promise<StorageDirCache> {
    const created = Date.now();

    // Check if this is the first SD - if so, make it active
    const existing = await this.getAllStorageDirs();
    const isActive = existing.length === 0;

    // Create the directory on disk if it doesn't exist
    if (!fs.existsSync(sdPath)) {
      fs.mkdirSync(sdPath, { recursive: true });
    }

    // Create required subdirectories
    const notesDir = path.join(sdPath, 'notes');
    if (!fs.existsSync(notesDir)) {
      fs.mkdirSync(notesDir, { recursive: true });
    }

    // Initialize SD UUID (Option C: auto-generate + read-back reconciliation)
    const fsAdapter = new NodeFsAdapter();
    const uuidManager = new SdUuidManager(fsAdapter);
    const uuidResult = await uuidManager.initializeUuid(sdPath);

    console.log(
      `[SD UUID] Initialized UUID for SD at ${sdPath}: ${uuidResult.uuid}`,
      uuidResult.wasGenerated ? '(generated)' : '(existing)',
      uuidResult.hadRaceCondition ? '⚠️ race condition detected, adopted existing UUID' : ''
    );

    await this.adapter.exec(
      'INSERT INTO storage_dirs (id, name, path, uuid, created, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, sdPath, uuidResult.uuid, created, isActive ? 1 : 0]
    );

    return { id, name, path: sdPath, uuid: uuidResult.uuid, created, isActive };
  }

  async getStorageDir(id: string): Promise<StorageDirCache | null> {
    const row = await this.adapter.get<{
      id: string;
      name: string;
      path: string;
      uuid: string | null;
      created: number;
      is_active: number;
    }>('SELECT * FROM storage_dirs WHERE id = ?', [id]);

    return row ? this.mapStorageDirRow(row) : null;
  }

  async getStorageDirByUuid(uuid: string): Promise<StorageDirCache | null> {
    const row = await this.adapter.get<{
      id: string;
      name: string;
      path: string;
      uuid: string | null;
      created: number;
      is_active: number;
    }>('SELECT * FROM storage_dirs WHERE uuid = ?', [uuid]);

    return row ? this.mapStorageDirRow(row) : null;
  }

  async getAllStorageDirs(): Promise<StorageDirCache[]> {
    const rows = await this.adapter.all<{
      id: string;
      name: string;
      path: string;
      uuid: string | null;
      created: number;
      is_active: number;
    }>('SELECT * FROM storage_dirs ORDER BY created ASC');

    return rows.map((row) => this.mapStorageDirRow(row));
  }

  async getActiveStorageDir(): Promise<StorageDirCache | null> {
    const row = await this.adapter.get<{
      id: string;
      name: string;
      path: string;
      uuid: string | null;
      created: number;
      is_active: number;
    }>('SELECT * FROM storage_dirs WHERE is_active = 1 LIMIT 1');

    return row ? this.mapStorageDirRow(row) : null;
  }

  async setActiveStorageDir(id: string): Promise<void> {
    // First, deactivate all SDs
    await this.adapter.exec('UPDATE storage_dirs SET is_active = 0');

    // Then activate the specified SD
    await this.adapter.exec('UPDATE storage_dirs SET is_active = 1 WHERE id = ?', [id]);
  }

  async deleteStorageDir(id: string): Promise<void> {
    // Delete all notes from this SD
    await this.adapter.exec('DELETE FROM notes WHERE sd_id = ?', [id]);

    // Delete all folders from this SD
    await this.adapter.exec('DELETE FROM folders WHERE sd_id = ?', [id]);

    // Delete the SD itself
    await this.adapter.exec('DELETE FROM storage_dirs WHERE id = ?', [id]);
  }

  /**
   * Clean up orphaned data (notes/folders/tags from deleted SDs)
   * This should be called on startup to ensure database integrity
   */
  async cleanupOrphanedData(): Promise<{
    notesDeleted: number;
    foldersDeleted: number;
    tagAssociationsDeleted: number;
    unusedTagsDeleted: number;
  }> {
    console.log('[Database] Cleaning up orphaned data...');

    // Cast adapter to a type with run() method
    const adapter = this.adapter as DatabaseAdapter & {
      run(sql: string, params?: unknown[]): Promise<{ changes: number }>;
    };

    // Delete orphaned notes (notes from SDs that no longer exist)
    const notesResult = await adapter.run(
      'DELETE FROM notes WHERE sd_id NOT IN (SELECT id FROM storage_dirs)'
    );

    // Delete orphaned folders
    const foldersResult = await adapter.run(
      'DELETE FROM folders WHERE sd_id NOT IN (SELECT id FROM storage_dirs)'
    );

    // Delete orphaned tag associations (tags for notes that no longer exist)
    const tagAssociationsResult = await adapter.run(
      'DELETE FROM note_tags WHERE note_id NOT IN (SELECT id FROM notes)'
    );

    // Delete unused tags (tags with no note associations)
    const unusedTagsResult = await adapter.run(
      'DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM note_tags)'
    );

    const notesDeleted = notesResult.changes;
    const foldersDeleted = foldersResult.changes;
    const tagAssociationsDeleted = tagAssociationsResult.changes;
    const unusedTagsDeleted = unusedTagsResult.changes;

    const result = {
      notesDeleted,
      foldersDeleted,
      tagAssociationsDeleted,
      unusedTagsDeleted,
    };

    if (
      result.notesDeleted > 0 ||
      result.foldersDeleted > 0 ||
      result.tagAssociationsDeleted > 0 ||
      result.unusedTagsDeleted > 0
    ) {
      console.log(
        `[Database] Cleaned up ${result.notesDeleted} orphaned note(s), ${result.foldersDeleted} orphaned folder(s), ${result.tagAssociationsDeleted} orphaned tag association(s), ${result.unusedTagsDeleted} unused tag(s)`
      );
    } else {
      console.log('[Database] No orphaned data found');
    }

    return result;
  }

  async updateStorageDirPath(id: string, newPath: string): Promise<void> {
    await this.adapter.exec('UPDATE storage_dirs SET path = ? WHERE id = ?', [newPath, id]);
  }

  /**
   * Rename a storage directory
   * @param id Storage directory ID
   * @param newName New name (1-255 chars, will be trimmed)
   * @throws Error if name is empty, whitespace-only, too long, already exists, or SD not found
   */
  async updateStorageDirName(id: string, newName: string): Promise<void> {
    // Trim whitespace from name
    const trimmedName = newName.trim();

    // Validate: non-empty
    if (trimmedName.length === 0) {
      throw new Error('Storage directory name cannot be empty');
    }

    // Validate: max length
    if (trimmedName.length > 255) {
      throw new Error('Storage directory name cannot exceed 255 characters');
    }

    // Check that the SD exists
    const existing = await this.getStorageDir(id);
    if (!existing) {
      throw new Error('Storage directory not found');
    }

    // Check for duplicate name (excluding self)
    const duplicate = await this.adapter.get<{ id: string }>(
      'SELECT id FROM storage_dirs WHERE name = ? AND id != ?',
      [trimmedName, id]
    );
    if (duplicate) {
      throw new Error('A storage directory with this name already exists');
    }

    // Update the name
    await this.adapter.exec('UPDATE storage_dirs SET name = ? WHERE id = ?', [trimmedName, id]);
  }

  private mapStorageDirRow(row: {
    id: string;
    name: string;
    path: string;
    uuid: string | null;
    created: number;
    is_active: number;
  }): StorageDirCache {
    return {
      id: row.id,
      name: row.name,
      path: row.path,
      uuid: row.uuid,
      created: row.created,
      isActive: row.is_active === 1,
    };
  }

  // ============================================================================
  // Schema Version Operations
  // ============================================================================

  async getCurrentVersion(): Promise<number | null> {
    const row = await this.adapter.get<{ version: number }>(
      'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
    );

    return row?.version ?? null;
  }

  async getVersionHistory(): Promise<SchemaVersionRecord[]> {
    const rows = await this.adapter.all<{
      version: number;
      applied_at: number;
      description: string;
    }>('SELECT * FROM schema_version ORDER BY version DESC');

    return rows.map((row) => ({
      version: row.version,
      appliedAt: row.applied_at,
      description: row.description,
    }));
  }

  async recordVersion(version: number, description: string): Promise<void> {
    await this.adapter.exec(
      'INSERT OR IGNORE INTO schema_version (version, applied_at, description) VALUES (?, ?, ?)',
      [version, Date.now(), description]
    );
  }

  // NoteSyncStateOperations implementation

  async getNoteSyncState(noteId: string, sdId: string): Promise<NoteSyncState | null> {
    const row = await this.adapter.get<{
      note_id: string;
      sd_id: string;
      vector_clock: string;
      document_state: Buffer;
      updated_at: number;
    }>('SELECT * FROM note_sync_state WHERE note_id = ? AND sd_id = ?', [noteId, sdId]);

    if (!row) return null;

    return {
      noteId: row.note_id,
      sdId: row.sd_id,
      vectorClock: row.vector_clock,
      documentState: new Uint8Array(row.document_state),
      updatedAt: row.updated_at,
    };
  }

  async upsertNoteSyncState(state: NoteSyncState): Promise<void> {
    await this.adapter.exec(
      `INSERT INTO note_sync_state (note_id, sd_id, vector_clock, document_state, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(note_id, sd_id) DO UPDATE SET
         vector_clock = excluded.vector_clock,
         document_state = excluded.document_state,
         updated_at = excluded.updated_at`,
      [
        state.noteId,
        state.sdId,
        state.vectorClock,
        Buffer.from(state.documentState),
        state.updatedAt,
      ]
    );
  }

  async deleteNoteSyncState(noteId: string, sdId: string): Promise<void> {
    await this.adapter.exec('DELETE FROM note_sync_state WHERE note_id = ? AND sd_id = ?', [
      noteId,
      sdId,
    ]);
  }

  async getNoteSyncStatesBySd(sdId: string): Promise<NoteSyncState[]> {
    const rows = await this.adapter.all<{
      note_id: string;
      sd_id: string;
      vector_clock: string;
      document_state: Buffer;
      updated_at: number;
    }>('SELECT * FROM note_sync_state WHERE sd_id = ?', [sdId]);

    return rows.map((row) => ({
      noteId: row.note_id,
      sdId: row.sd_id,
      vectorClock: row.vector_clock,
      documentState: new Uint8Array(row.document_state),
      updatedAt: row.updated_at,
    }));
  }

  async deleteNoteSyncStatesBySd(sdId: string): Promise<void> {
    await this.adapter.exec('DELETE FROM note_sync_state WHERE sd_id = ?', [sdId]);
  }

  // FolderSyncStateOperations implementation

  async getFolderSyncState(sdId: string): Promise<FolderSyncState | null> {
    const row = await this.adapter.get<{
      sd_id: string;
      vector_clock: string;
      document_state: Buffer;
      updated_at: number;
    }>('SELECT * FROM folder_sync_state WHERE sd_id = ?', [sdId]);

    if (!row) return null;

    return {
      sdId: row.sd_id,
      vectorClock: row.vector_clock,
      documentState: new Uint8Array(row.document_state),
      updatedAt: row.updated_at,
    };
  }

  async upsertFolderSyncState(state: FolderSyncState): Promise<void> {
    await this.adapter.exec(
      `INSERT INTO folder_sync_state (sd_id, vector_clock, document_state, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(sd_id) DO UPDATE SET
         vector_clock = excluded.vector_clock,
         document_state = excluded.document_state,
         updated_at = excluded.updated_at`,
      [state.sdId, state.vectorClock, Buffer.from(state.documentState), state.updatedAt]
    );
  }

  async deleteFolderSyncState(sdId: string): Promise<void> {
    await this.adapter.exec('DELETE FROM folder_sync_state WHERE sd_id = ?', [sdId]);
  }

  // Profile presence cache operations

  async getProfilePresenceCache(
    profileId: string,
    sdId: string
  ): Promise<CachedProfilePresence | null> {
    const row = await this.adapter.get<{
      profile_id: string;
      instance_id: string | null;
      sd_id: string;
      profile_name: string | null;
      user: string | null;
      username: string | null;
      hostname: string | null;
      platform: string | null;
      app_version: string | null;
      last_updated: number | null;
      cached_at: number;
    }>('SELECT * FROM profile_presence_cache WHERE profile_id = ? AND sd_id = ?', [
      profileId,
      sdId,
    ]);

    if (!row) return null;

    return {
      profileId: row.profile_id,
      instanceId: row.instance_id,
      sdId: row.sd_id,
      profileName: row.profile_name,
      user: row.user,
      username: row.username,
      hostname: row.hostname,
      platform: row.platform,
      appVersion: row.app_version,
      lastUpdated: row.last_updated,
      cachedAt: row.cached_at,
    };
  }

  async getProfilePresenceCacheByInstanceId(
    instanceId: string,
    sdId: string
  ): Promise<CachedProfilePresence | null> {
    const row = await this.adapter.get<{
      profile_id: string;
      instance_id: string | null;
      sd_id: string;
      profile_name: string | null;
      user: string | null;
      username: string | null;
      hostname: string | null;
      platform: string | null;
      app_version: string | null;
      last_updated: number | null;
      cached_at: number;
    }>('SELECT * FROM profile_presence_cache WHERE instance_id = ? AND sd_id = ?', [
      instanceId,
      sdId,
    ]);

    if (!row) return null;

    return {
      profileId: row.profile_id,
      instanceId: row.instance_id,
      sdId: row.sd_id,
      profileName: row.profile_name,
      user: row.user,
      username: row.username,
      hostname: row.hostname,
      platform: row.platform,
      appVersion: row.app_version,
      lastUpdated: row.last_updated,
      cachedAt: row.cached_at,
    };
  }

  async getProfilePresenceCacheBySd(sdId: string): Promise<CachedProfilePresence[]> {
    const rows = await this.adapter.all<{
      profile_id: string;
      instance_id: string | null;
      sd_id: string;
      profile_name: string | null;
      user: string | null;
      username: string | null;
      hostname: string | null;
      platform: string | null;
      app_version: string | null;
      last_updated: number | null;
      cached_at: number;
    }>('SELECT * FROM profile_presence_cache WHERE sd_id = ?', [sdId]);

    return rows.map((row) => ({
      profileId: row.profile_id,
      instanceId: row.instance_id,
      sdId: row.sd_id,
      profileName: row.profile_name,
      user: row.user,
      username: row.username,
      hostname: row.hostname,
      platform: row.platform,
      appVersion: row.app_version,
      lastUpdated: row.last_updated,
      cachedAt: row.cached_at,
    }));
  }

  async upsertProfilePresenceCache(presence: CachedProfilePresence): Promise<void> {
    await this.adapter.exec(
      `INSERT INTO profile_presence_cache (
        profile_id, instance_id, sd_id, profile_name, user, username, hostname,
        platform, app_version, last_updated, cached_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(profile_id, sd_id) DO UPDATE SET
        instance_id = excluded.instance_id,
        profile_name = excluded.profile_name,
        user = excluded.user,
        username = excluded.username,
        hostname = excluded.hostname,
        platform = excluded.platform,
        app_version = excluded.app_version,
        last_updated = excluded.last_updated,
        cached_at = excluded.cached_at`,
      [
        presence.profileId,
        presence.instanceId,
        presence.sdId,
        presence.profileName,
        presence.user,
        presence.username,
        presence.hostname,
        presence.platform,
        presence.appVersion,
        presence.lastUpdated,
        presence.cachedAt,
      ]
    );
  }

  async deleteProfilePresenceCache(profileId: string, sdId: string): Promise<void> {
    await this.adapter.exec(
      'DELETE FROM profile_presence_cache WHERE profile_id = ? AND sd_id = ?',
      [profileId, sdId]
    );
  }

  async deleteProfilePresenceCacheBySd(sdId: string): Promise<void> {
    await this.adapter.exec('DELETE FROM profile_presence_cache WHERE sd_id = ?', [sdId]);
  }

  // ============================================================================
  // Image Cache Operations
  // ============================================================================

  async upsertImage(image: ImageCache): Promise<void> {
    await this.adapter.exec(
      `INSERT INTO images (id, sd_id, filename, mime_type, width, height, size, created)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         sd_id = excluded.sd_id,
         filename = excluded.filename,
         mime_type = excluded.mime_type,
         width = excluded.width,
         height = excluded.height,
         size = excluded.size,
         created = excluded.created`,
      [
        image.id,
        image.sdId,
        image.filename,
        image.mimeType,
        image.width,
        image.height,
        image.size,
        image.created,
      ]
    );
  }

  async getImage(imageId: UUID): Promise<ImageCache | null> {
    const row = await this.adapter.get<{
      id: string;
      sd_id: string;
      filename: string;
      mime_type: string;
      width: number | null;
      height: number | null;
      size: number;
      created: number;
    }>('SELECT * FROM images WHERE id = ?', [imageId]);

    if (!row) return null;

    return {
      id: row.id,
      sdId: row.sd_id,
      filename: row.filename,
      mimeType: row.mime_type,
      width: row.width,
      height: row.height,
      size: row.size,
      created: row.created,
    };
  }

  async getImagesBySd(sdId: string): Promise<ImageCache[]> {
    const rows = await this.adapter.all<{
      id: string;
      sd_id: string;
      filename: string;
      mime_type: string;
      width: number | null;
      height: number | null;
      size: number;
      created: number;
    }>('SELECT * FROM images WHERE sd_id = ? ORDER BY created DESC', [sdId]);

    return rows.map((row) => ({
      id: row.id,
      sdId: row.sd_id,
      filename: row.filename,
      mimeType: row.mime_type,
      width: row.width,
      height: row.height,
      size: row.size,
      created: row.created,
    }));
  }

  async deleteImage(imageId: UUID): Promise<void> {
    await this.adapter.exec('DELETE FROM images WHERE id = ?', [imageId]);
  }

  async imageExists(imageId: UUID): Promise<boolean> {
    const row = await this.adapter.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM images WHERE id = ?',
      [imageId]
    );
    return (row?.count ?? 0) > 0;
  }

  async getImageStorageSize(sdId: string): Promise<number> {
    const row = await this.adapter.get<{ total: number | null }>(
      'SELECT SUM(size) as total FROM images WHERE sd_id = ?',
      [sdId]
    );
    return row?.total ?? 0;
  }

  async getImageCount(sdId: string): Promise<number> {
    const row = await this.adapter.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM images WHERE sd_id = ?',
      [sdId]
    );
    return row?.count ?? 0;
  }

  // ============================================================================
  // Comment Thread Operations
  // ============================================================================

  async upsertCommentThread(thread: CommentThreadCache): Promise<void> {
    await this.adapter.exec(
      `INSERT INTO comment_threads (
        id, note_id, anchor_start, anchor_end, original_text,
        author_id, author_name, author_handle, content,
        created, modified, resolved, resolved_by, resolved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        note_id = excluded.note_id,
        anchor_start = excluded.anchor_start,
        anchor_end = excluded.anchor_end,
        original_text = excluded.original_text,
        author_id = excluded.author_id,
        author_name = excluded.author_name,
        author_handle = excluded.author_handle,
        content = excluded.content,
        created = excluded.created,
        modified = excluded.modified,
        resolved = excluded.resolved,
        resolved_by = excluded.resolved_by,
        resolved_at = excluded.resolved_at`,
      [
        thread.id,
        thread.noteId,
        Buffer.from(thread.anchorStart),
        Buffer.from(thread.anchorEnd),
        thread.originalText,
        thread.authorId,
        thread.authorName,
        thread.authorHandle,
        thread.content,
        thread.created,
        thread.modified,
        thread.resolved ? 1 : 0,
        thread.resolvedBy,
        thread.resolvedAt,
      ]
    );
  }

  async getCommentThread(threadId: UUID): Promise<CommentThreadCache | null> {
    const row = await this.adapter.get<{
      id: string;
      note_id: string;
      anchor_start: Buffer;
      anchor_end: Buffer;
      original_text: string;
      author_id: string;
      author_name: string;
      author_handle: string;
      content: string;
      created: number;
      modified: number;
      resolved: number;
      resolved_by: string | null;
      resolved_at: number | null;
    }>('SELECT * FROM comment_threads WHERE id = ?', [threadId]);

    return row ? this.mapCommentThreadRow(row) : null;
  }

  async getCommentThreadsForNote(noteId: UUID): Promise<CommentThreadCache[]> {
    const rows = await this.adapter.all<{
      id: string;
      note_id: string;
      anchor_start: Buffer;
      anchor_end: Buffer;
      original_text: string;
      author_id: string;
      author_name: string;
      author_handle: string;
      content: string;
      created: number;
      modified: number;
      resolved: number;
      resolved_by: string | null;
      resolved_at: number | null;
    }>('SELECT * FROM comment_threads WHERE note_id = ? ORDER BY created ASC', [noteId]);

    return rows.map((row) => this.mapCommentThreadRow(row));
  }

  async deleteCommentThread(threadId: UUID): Promise<void> {
    await this.adapter.exec('DELETE FROM comment_threads WHERE id = ?', [threadId]);
  }

  async deleteCommentThreadsForNote(noteId: UUID): Promise<void> {
    await this.adapter.exec('DELETE FROM comment_threads WHERE note_id = ?', [noteId]);
  }

  private mapCommentThreadRow(row: {
    id: string;
    note_id: string;
    anchor_start: Buffer;
    anchor_end: Buffer;
    original_text: string;
    author_id: string;
    author_name: string;
    author_handle: string;
    content: string;
    created: number;
    modified: number;
    resolved: number;
    resolved_by: string | null;
    resolved_at: number | null;
  }): CommentThreadCache {
    return {
      id: row.id,
      noteId: row.note_id,
      anchorStart: new Uint8Array(row.anchor_start),
      anchorEnd: new Uint8Array(row.anchor_end),
      originalText: row.original_text,
      authorId: row.author_id,
      authorName: row.author_name,
      authorHandle: row.author_handle,
      content: row.content,
      created: row.created,
      modified: row.modified,
      resolved: row.resolved === 1,
      resolvedBy: row.resolved_by,
      resolvedAt: row.resolved_at,
    };
  }

  // ============================================================================
  // Comment Reply Operations
  // ============================================================================

  async upsertCommentReply(reply: CommentReplyCache): Promise<void> {
    await this.adapter.exec(
      `INSERT INTO comment_replies (
        id, thread_id, author_id, author_name, author_handle, content, created, modified
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        thread_id = excluded.thread_id,
        author_id = excluded.author_id,
        author_name = excluded.author_name,
        author_handle = excluded.author_handle,
        content = excluded.content,
        created = excluded.created,
        modified = excluded.modified`,
      [
        reply.id,
        reply.threadId,
        reply.authorId,
        reply.authorName,
        reply.authorHandle,
        reply.content,
        reply.created,
        reply.modified,
      ]
    );
  }

  async getCommentReply(replyId: UUID): Promise<CommentReplyCache | null> {
    const row = await this.adapter.get<{
      id: string;
      thread_id: string;
      author_id: string;
      author_name: string;
      author_handle: string;
      content: string;
      created: number;
      modified: number;
    }>('SELECT * FROM comment_replies WHERE id = ?', [replyId]);

    return row ? this.mapCommentReplyRow(row) : null;
  }

  async getRepliesForThread(threadId: UUID): Promise<CommentReplyCache[]> {
    const rows = await this.adapter.all<{
      id: string;
      thread_id: string;
      author_id: string;
      author_name: string;
      author_handle: string;
      content: string;
      created: number;
      modified: number;
    }>('SELECT * FROM comment_replies WHERE thread_id = ? ORDER BY created ASC', [threadId]);

    return rows.map((row) => this.mapCommentReplyRow(row));
  }

  async deleteCommentReply(replyId: UUID): Promise<void> {
    await this.adapter.exec('DELETE FROM comment_replies WHERE id = ?', [replyId]);
  }

  async deleteRepliesForThread(threadId: UUID): Promise<void> {
    await this.adapter.exec('DELETE FROM comment_replies WHERE thread_id = ?', [threadId]);
  }

  private mapCommentReplyRow(row: {
    id: string;
    thread_id: string;
    author_id: string;
    author_name: string;
    author_handle: string;
    content: string;
    created: number;
    modified: number;
  }): CommentReplyCache {
    return {
      id: row.id,
      threadId: row.thread_id,
      authorId: row.author_id,
      authorName: row.author_name,
      authorHandle: row.author_handle,
      content: row.content,
      created: row.created,
      modified: row.modified,
    };
  }

  // ============================================================================
  // Comment Reaction Operations
  // ============================================================================

  async upsertCommentReaction(reaction: CommentReactionCache): Promise<void> {
    await this.adapter.exec(
      `INSERT INTO comment_reactions (
        id, target_type, target_id, emoji, author_id, author_name, created
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        target_type = excluded.target_type,
        target_id = excluded.target_id,
        emoji = excluded.emoji,
        author_id = excluded.author_id,
        author_name = excluded.author_name,
        created = excluded.created`,
      [
        reaction.id,
        reaction.targetType,
        reaction.targetId,
        reaction.emoji,
        reaction.authorId,
        reaction.authorName,
        reaction.created,
      ]
    );
  }

  async getCommentReaction(reactionId: UUID): Promise<CommentReactionCache | null> {
    const row = await this.adapter.get<{
      id: string;
      target_type: string;
      target_id: string;
      emoji: string;
      author_id: string;
      author_name: string;
      created: number;
    }>('SELECT * FROM comment_reactions WHERE id = ?', [reactionId]);

    return row ? this.mapCommentReactionRow(row) : null;
  }

  async getReactionsForTarget(
    targetType: 'thread' | 'reply',
    targetId: UUID
  ): Promise<CommentReactionCache[]> {
    const rows = await this.adapter.all<{
      id: string;
      target_type: string;
      target_id: string;
      emoji: string;
      author_id: string;
      author_name: string;
      created: number;
    }>(
      'SELECT * FROM comment_reactions WHERE target_type = ? AND target_id = ? ORDER BY created ASC',
      [targetType, targetId]
    );

    return rows.map((row) => this.mapCommentReactionRow(row));
  }

  async deleteCommentReaction(reactionId: UUID): Promise<void> {
    await this.adapter.exec('DELETE FROM comment_reactions WHERE id = ?', [reactionId]);
  }

  async deleteReactionsForTarget(targetType: 'thread' | 'reply', targetId: UUID): Promise<void> {
    await this.adapter.exec(
      'DELETE FROM comment_reactions WHERE target_type = ? AND target_id = ?',
      [targetType, targetId]
    );
  }

  private mapCommentReactionRow(row: {
    id: string;
    target_type: string;
    target_id: string;
    emoji: string;
    author_id: string;
    author_name: string;
    created: number;
  }): CommentReactionCache {
    return {
      id: row.id,
      targetType: row.target_type as 'thread' | 'reply',
      targetId: row.target_id,
      emoji: row.emoji,
      authorId: row.author_id,
      authorName: row.author_name,
      created: row.created,
    };
  }
}
