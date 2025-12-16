/**
 * Note Repository
 * Handles all note cache operations
 */

import type { DatabaseAdapter, NoteCache, SearchResult, UUID } from '@notecove/shared';

export class NoteRepository {
  constructor(private readonly adapter: DatabaseAdapter) {}

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
    // Transform special patterns in the query to match the indexed format
    // e.g., "#work" becomes "__hashtag__work", "/feature" becomes "__slash__feature"
    let transformedQuery = query;
    // Transform hashtags: #tag -> __hashtag__tag
    transformedQuery = transformedQuery.replace(/#(\w+)/g, '__hashtag__$1');
    // Transform slash commands: /command -> __slash__command (at word boundaries)
    transformedQuery = transformedQuery.replace(/(?:^|(?<=\s))\/(\w+)/g, '__slash__$1');

    // FTS5 special characters that need to be quoted (excluding # which is now transformed)
    // These characters have special meaning in FTS5 query syntax or cause parse errors
    // Includes: / . - ' , ; % ? = ` + and the original set @ : ^ $ ( ) { } [ ] \ | ! & ~ < >
    const fts5SpecialChars = /[/@:.^$(){}[\]\\|!&~<>'\-,;%?=`+]/;

    // Transform query to support prefix matching
    // For each word >=3 chars, add wildcard for prefix search
    const fts5Query = transformedQuery
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0)
      .map((word) => {
        // If it's already a quoted phrase, keep it as is
        if (word.startsWith('"') && word.endsWith('"')) {
          return word;
        }
        // If word contains *, user wants wildcard behavior - leave unchanged
        if (word.includes('*')) {
          return word;
        }
        // If it contains special characters, quote it and add prefix wildcard for >= 3 chars
        if (fts5SpecialChars.test(word)) {
          // Escape any internal quotes and wrap in quotes
          const escaped = word.replace(/"/g, '""');
          // Add prefix wildcard for longer terms
          if (word.length >= 3) {
            return `"${escaped}"*`;
          }
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
}
