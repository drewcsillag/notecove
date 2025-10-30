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
} from '@notecove/shared';
import { SCHEMA_SQL, SCHEMA_VERSION } from '@notecove/shared';
import type { UUID } from '@notecove/shared';

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
    await this.adapter.exec(`
      CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
        INSERT INTO notes_fts(note_id, title, content)
        VALUES (new.id, new.title, new.content_text);
      END;
    `);

    await this.adapter.exec(`
      CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
        DELETE FROM notes_fts WHERE note_id = old.id;
      END;
    `);

    await this.adapter.exec(`
      CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
        UPDATE notes_fts SET title = new.title, content = new.content_text
        WHERE note_id = new.id;
      END;
    `);

    await this.adapter.exec(SCHEMA_SQL.folders);
    await this.adapter.exec(SCHEMA_SQL.tags);
    await this.adapter.exec(SCHEMA_SQL.noteTags);
    await this.adapter.exec(SCHEMA_SQL.users);
    await this.adapter.exec(SCHEMA_SQL.appState);
  }

  /**
   * Ensure schema version is current
   */
  private async ensureSchemaVersion(): Promise<void> {
    const currentVersion = await this.getCurrentVersion();

    if (currentVersion === null) {
      // First time setup
      await this.recordVersion(SCHEMA_VERSION, 'Initial schema');
    } else if (currentVersion !== SCHEMA_VERSION) {
      // TODO: Implement migration logic when schema version changes
      // For now, just record the new version
      await this.recordVersion(SCHEMA_VERSION, `Migration to v${SCHEMA_VERSION}`);
    }
  }

  // ============================================================================
  // Note Cache Operations
  // ============================================================================

  async upsertNote(note: NoteCache): Promise<void> {
    await this.adapter.exec(
      `INSERT INTO notes (id, title, sd_id, folder_id, created, modified, deleted, content_preview, content_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         sd_id = excluded.sd_id,
         folder_id = excluded.folder_id,
         created = excluded.created,
         modified = excluded.modified,
         deleted = excluded.deleted,
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
      content_preview: string;
      content_text: string;
    }>('SELECT * FROM notes WHERE deleted = 0 ORDER BY modified DESC');

    return rows.map((row) => this.mapNoteRow(row));
  }

  async getDeletedNotes(): Promise<NoteCache[]> {
    const rows = await this.adapter.all<{
      id: string;
      title: string;
      sd_id: string;
      folder_id: string | null;
      created: number;
      modified: number;
      deleted: number;
      content_preview: string;
      content_text: string;
    }>('SELECT * FROM notes WHERE deleted = 1 ORDER BY modified DESC');

    return rows.map((row) => this.mapNoteRow(row));
  }

  async deleteNote(noteId: UUID): Promise<void> {
    await this.adapter.exec('DELETE FROM notes WHERE id = ?', [noteId]);
  }

  async searchNotes(query: string, limit = 50): Promise<SearchResult[]> {
    // Transform query to support prefix matching
    // For each word >=3 chars, add wildcard for prefix search
    const fts5Query = query
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0)
      .map((word) => {
        // If it's already a quoted phrase, keep it as is
        if (word.startsWith('"') && word.endsWith('"')) {
          return word;
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
        note_id,
        title,
        snippet(notes_fts, 2, '', '', '...', 32) as content,
        rank
      FROM notes_fts
      WHERE notes_fts MATCH ?
      ORDER BY rank
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

  private mapNoteRow(row: {
    id: string;
    title: string;
    sd_id: string;
    folder_id: string | null;
    created: number;
    modified: number;
    deleted: number;
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

  async getAllTags(): Promise<Tag[]> {
    const rows = await this.adapter.all<{ id: string; name: string }>(
      'SELECT * FROM tags ORDER BY name COLLATE NOCASE'
    );

    return rows.map((row) => ({ id: row.id, name: row.name }));
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

    await this.adapter.exec(
      'INSERT INTO storage_dirs (id, name, path, created, is_active) VALUES (?, ?, ?, ?, ?)',
      [id, name, sdPath, created, isActive ? 1 : 0]
    );

    return { id, name, path: sdPath, created, isActive };
  }

  async getStorageDir(id: string): Promise<StorageDirCache | null> {
    const row = await this.adapter.get<{
      id: string;
      name: string;
      path: string;
      created: number;
      is_active: number;
    }>('SELECT * FROM storage_dirs WHERE id = ?', [id]);

    return row ? this.mapStorageDirRow(row) : null;
  }

  async getAllStorageDirs(): Promise<StorageDirCache[]> {
    const rows = await this.adapter.all<{
      id: string;
      name: string;
      path: string;
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
    await this.adapter.exec('DELETE FROM storage_dirs WHERE id = ?', [id]);
  }

  private mapStorageDirRow(row: {
    id: string;
    name: string;
    path: string;
    created: number;
    is_active: number;
  }): StorageDirCache {
    return {
      id: row.id,
      name: row.name,
      path: row.path,
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
}
